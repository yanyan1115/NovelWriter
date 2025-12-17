// src/storage/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// --- 小说存储key 和接口 ---
const NOVEL_ID_LIST_KEY = 'novel_ids';
const NOVEL_KEY_PREFIX = 'novel_';

// 大文件改用文件系统保存，避免 AsyncStorage(SQLite) 的容量上限（Android 默认约 6MB 全库大小）
const FILE_STORAGE_THRESHOLD = 256 * 1024; // >256KB 切换到文件存储

// 为规避 AsyncStorage 在 Android 上基于 SQLite 的单行/单值大小限制（约 2MB/CursorWindow），
// 对体积较大的小说对象进行分片存储（仅作为保底方案）。
const MAX_ASYNCSTORAGE_CHUNK = 64 * 1024; // 64KB/片，更保守以规避部分机型限制

const novelKey = (id) => `${NOVEL_KEY_PREFIX}${id}`;
const novelPartKey = (id, idx) => `${NOVEL_KEY_PREFIX}${id}_part_${idx}`;

// 基于文件的小说保存目录
const NOVEL_FILE_DIR = FileSystem.documentDirectory + 'novels/';
const ensureNovelDirExists = async () => {
  const info = await FileSystem.getInfoAsync(NOVEL_FILE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(NOVEL_FILE_DIR, { intermediates: true });
  }
};

const isSqliteFullError = (e) => {
  const msg = (e && (e.message || e.toString())) || '';
  return /SQLITE_FULL|database or disk is full/i.test(msg);
};

const saveNovelToFile = async (id, json) => {
  await ensureNovelDirExists();
  const fileUri = NOVEL_FILE_DIR + `novel-${id}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  // 在 AsyncStorage 里仅保存一个指针元信息
  const meta = { __file: true, uri: fileUri, version: 1 };
  await AsyncStorage.setItem(novelKey(id), JSON.stringify(meta));
  // 清理可能存在的历史分片
  await cleanupNovelChunks(id, 0);
  console.log(`[保存小说-文件] id=${id} -> ${fileUri}`);
  return fileUri;
};

const readNovelFromFile = async (uri) => {
  const json = await FileSystem.readAsStringAsync(uri);
  return JSON.parse(json);
};

const cleanupNovelChunks = async (novelId, keepParts = 0) => {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `${NOVEL_KEY_PREFIX}${novelId}_part_`;
  const partKeys = allKeys.filter(k => k.startsWith(prefix));
  // 如果需要保留前 keepParts 个分片，其余删除
  let toRemove = partKeys;
  if (keepParts > 0) {
    const keepSet = new Set(Array.from({ length: keepParts }, (_, i) => novelPartKey(novelId, i)));
    toRemove = partKeys.filter(k => !keepSet.has(k));
  }
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
};

const saveNovelChunked = async (novelObj) => {
  const id = novelObj.id;
  const json = JSON.stringify(novelObj);
  console.log(`[保存小说] id=${id} 总长度=${json.length}B`);

  // 大于阈值，优先使用文件存储，彻底绕开 SQLite 限制
  if (json.length > FILE_STORAGE_THRESHOLD) {
    try {
      await saveNovelToFile(id, json);
      return;
    } catch (e) {
      console.warn(`[保存小说-文件失败，转用分片] id=${id} err=${e?.message || e}`);
      // 继续走分片降级策略
    }
  }

  // 小对象，直接保存并清理历史分片
  if (json.length <= MAX_ASYNCSTORAGE_CHUNK) {
    try {
      console.log(`[保存小说-直存] id=${id} 长度=${json.length}B`);
      await AsyncStorage.setItem(novelKey(id), json);
      await cleanupNovelChunks(id, 0);
      return;
    } catch (e) {
      if (isSqliteFullError(e)) {
        // 直存命中 SQLite 限制，切换到文件
        await saveNovelToFile(id, json);
        return;
      }
      throw e;
    }
  }

  const trySaveWithChunk = async (chunkSize) => {
    const parts = [];
    for (let i = 0; i < json.length; i += chunkSize) {
      parts.push(json.substring(i, i + chunkSize));
    }
    const meta = JSON.stringify({ __chunked: true, parts: parts.length, version: 1, chunkSize });
    console.log(`[保存小说-分片] id=${id} 分片大小=${chunkSize} 分片数=${parts.length}`);
    // 先写入元信息
    await AsyncStorage.setItem(novelKey(id), meta);
    // 再逐片写入，避免一次 multiSet 事务过大
    for (let idx = 0; idx < parts.length; idx++) {
      const key = novelPartKey(id, idx);
      try {
        await AsyncStorage.setItem(key, parts[idx]);
      } catch (err) {
        console.error(`[保存小说-分片失败] key=${key} size=${parts[idx]?.length} err=${err?.message || err}`);
        throw err;
      }
    }
    // 清理多余历史分片
    await cleanupNovelChunks(id, parts.length);
  };

  // 优先使用当前默认片大小，失败则逐级降级
  const fallbacks = [MAX_ASYNCSTORAGE_CHUNK, 32 * 1024, 16 * 1024, 8 * 1024, 4 * 1024, 2 * 1024, 1024];
  let lastError = null;
  for (const size of fallbacks) {
    try {
      await cleanupNovelChunks(id, 0); // 每次尝试前清理残留
      await trySaveWithChunk(size);
      return; // 成功
    } catch (e) {
      lastError = e;
      console.warn(`[保存小说-降级重试] id=${id} 片大小=${size} 失败：${e?.message || e}`);
      // 若命中 SQLITE_FULL/文件错误，直接切换文件存储
      if (isSqliteFullError(e)) {
        try {
          await saveNovelToFile(id, json);
          return;
        } catch (fileErr) {
          lastError = fileErr;
        }
      }
      continue;
    }
  }
  // 若所有方案均失败，抛出最后一次错误
  throw lastError || new Error('保存分片失败');
};

const readNovelPossiblyChunked = async (id) => {
  const base = await AsyncStorage.getItem(novelKey(id));
  if (!base) return null;

  try {
    const parsed = JSON.parse(base);

    // 文件存储元数据：直接从文件读取
    if (parsed && parsed.__file && parsed.uri) {
      try {
        return await readNovelFromFile(parsed.uri);
      } catch (e) {
        console.warn(`[读取小说-文件失败] id=${id} uri=${parsed.uri} err=${e?.message || e}`);
        return null;
      }
    }

    // 分片元数据：按分片读取并拼接
    if (parsed && parsed.__chunked && typeof parsed.parts === 'number') {
      const keys = Array.from({ length: parsed.parts }, (_, i) => novelPartKey(id, i));
      const pairs = await AsyncStorage.multiGet(keys);
      const json = pairs.map(([, v]) => v || '').join('');
      return JSON.parse(json);
    }
    // 非分片：直接返回对象
    return parsed;
  } catch (_) {
    // base 是完整 JSON 字符串（旧格式）：直接返回
    try {
      return JSON.parse(base);
    } catch (e2) {
      return null;
    }
  }
};

export const saveNovels = async (novels) => {
  try {
    // 添加健壮性检查，确保传入的是一个数组
    if (!Array.isArray(novels)) {
      throw new Error('saveNovels expects an array of novels.');
    }

    // 注意：章节正文迁移仅在导入TXT或编辑章节时进行
    const novelIds = novels.map(n => n.id);
    await AsyncStorage.setItem(NOVEL_ID_LIST_KEY, JSON.stringify(novelIds));

    // 按小说逐本保存（分片处理/或文件）
    for (const n of novels) {
      await saveNovelChunked(n);
    }

    // 如果保存后小说列表为空，我们还需要清理掉可能存在的孤立小说数据（含分片）
    if (novels.length === 0) {
      const allKeys = await AsyncStorage.getAllKeys();
      const oldNovelKeys = allKeys.filter(key => key.startsWith(NOVEL_KEY_PREFIX));
      if (oldNovelKeys.length > 0) {
        await AsyncStorage.multiRemove(oldNovelKeys);
      }
    }
  } catch (e) {
    console.error('保存小说失败', e);
  }
};

export const loadNovels = async () => {
  try {
    const idsJson = await AsyncStorage.getItem(NOVEL_ID_LIST_KEY);
    if (!idsJson) return [];

    const novelIds = JSON.parse(idsJson);
    const novels = [];
    for (const id of novelIds) {
      const obj = await readNovelPossiblyChunked(id);
      if (obj) novels.push(obj);
    }
    return novels;
  } catch (e) {
    console.error('读取小说失败', e);
    return [];
  }
};

// 新增：按ID读取单本小说，避免首屏加载全部小说
export const loadNovelById = async (id) => {
  try {
    if (!id) return null;
    return await readNovelPossiblyChunked(id);
  } catch (e) {
    console.error('按ID读取小说失败', e);
    return null;
  }
};

// --- 章节存储key 和接口 ---
const STORAGE_KEY_CHAPTERS = 'chapters'

// 章节正文改用文件系统存储，避免撑爆 AsyncStorage
const CHAPTER_CONTENT_KEY_PREFIX = 'chapter_content_'; // 存放轻量元信息（指向文件）
const CHAPTER_FILE_DIR = FileSystem.documentDirectory + 'chapters/';
const ensureChapterDirExists = async () => {
  const info = await FileSystem.getInfoAsync(CHAPTER_FILE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CHAPTER_FILE_DIR, { intermediates: true });
  }
};
const getChapterFileUri = (chapterId) => CHAPTER_FILE_DIR + `chapter-${chapterId}.txt`;

/**
 * 读取章节正文
 * 优先从文件读取；若不存在，则从小说对象中兜底读取（兼容旧数据）
 */
export const getChapterContent = async (chapterId) => {
  if (!chapterId) return '';
  try {
    // 先看是否有元信息
    const metaJson = await AsyncStorage.getItem(CHAPTER_CONTENT_KEY_PREFIX + chapterId);
    if (metaJson) {
      try {
        const meta = JSON.parse(metaJson);
        if (meta?.__file && meta?.uri) {
          const info = await FileSystem.getInfoAsync(meta.uri);
          if (info.exists) {
            return await FileSystem.readAsStringAsync(meta.uri);
          }
        }
      } catch (_) {}
    }

    // 没有元信息就按约定路径读取
    const uri = getChapterFileUri(chapterId);
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(uri);
    }

    // 兜底：从小说结构里找（仅为兼容历史数据）
    try {
      const novels = await loadNovels();
      for (const n of novels) {
        for (const v of n?.volumes || []) {
          const found = (v?.chapters || []).find(c => c.id === chapterId);
          if (found && typeof found.content === 'string') {
            return found.content;
          }
        }
      }
    } catch (_) {}

    return '';
  } catch (e) {
    console.error('读取章节正文失败', e);
    return '';
  }
};

/**
 * 保存章节正文（写入文件，并在 AsyncStorage 写一个轻量指针）
 */
export const saveChapterContent = async (chapterId, content) => {
  if (!chapterId) throw new Error('缺少 chapterId');
  const text = typeof content === 'string' ? content : '';
  await ensureChapterDirExists();
  const uri = getChapterFileUri(chapterId);
  await FileSystem.writeAsStringAsync(uri, text);
  // 不再向 AsyncStorage 写入任何章节正文元信息，避免大量键填满 SQLite
  return true;
};

/**
 * 删除章节正文文件与元信息
 */
export const deleteChapterContent = async (chapterId) => {
  try {
    const uri = getChapterFileUri(chapterId);
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    await AsyncStorage.removeItem(CHAPTER_CONTENT_KEY_PREFIX + chapterId);
  } catch (e) {
    console.warn('删除章节正文失败', e);
  }
};

export const getChaptersByNovelId = async (novelId) => {
  try {
    const key = `${STORAGE_KEY_CHAPTERS}_${novelId}`;
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('读取章节失败', e);
    return [];
  }
};

export const deleteChapterById = async (novelId, chapterId) => {
  try {
    const key = `${STORAGE_KEY_CHAPTERS}_${novelId}`;
    const chapters = await getChaptersByNovelId(novelId);
    const updatedChapters = chapters.filter(c => c.id !== chapterId);
    await AsyncStorage.setItem(key, JSON.stringify(updatedChapters));

    // 同步删除章节正文文件
    try { await deleteChapterContent(chapterId); } catch (_) {}
  } catch (e) {
    console.error('删除章节失败', e);
  }
};

export const updateChapterById = async (novelId, chapterId, updatedFields) => {
  try {
    const key = `${STORAGE_KEY_CHAPTERS}_${novelId}`;
    const chapters = await getChaptersByNovelId(novelId);
    const updatedChapters = chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, ...updatedFields };
      }
      return c;
    });
    await AsyncStorage.setItem(key, JSON.stringify(updatedChapters));
  } catch (e) {
    console.error('更新章节失败', e);
  }
};

export const createChapter = async (chapter) => {
  try {
    const { novelId } = chapter;
    if (!novelId) {
      throw new Error('创建章节需要 novelId');
    }
    const key = `${STORAGE_KEY_CHAPTERS}_${novelId}`;
    const chapters = await getChaptersByNovelId(novelId);
    const newChapter = { id: Date.now().toString(), ...chapter };
    chapters.push(newChapter);
    await AsyncStorage.setItem(key, JSON.stringify(chapters));
    return newChapter;
  } catch (e) {
    console.error('创建章节失败', e);
    return null;
  }
};

// --- 存储空间监控接口 ---

/**
 * 获取存储空间信息（同时统计文件存储与分片存储）
 * @returns {Promise<{estimatedSizeMB: number}>}
 */
export const getStorageInfo = async () => {
  try {
    let totalSize = 0
    
    // 计算小说数据大小
    const idsJson = await AsyncStorage.getItem(NOVEL_ID_LIST_KEY);
    if (idsJson) {
      const novelIds = JSON.parse(idsJson);
      for (const id of novelIds) {
        const base = await AsyncStorage.getItem(novelKey(id));
        if (!base) continue;
        try {
          const meta = JSON.parse(base);
          if (meta && meta.__file && meta.uri) {
            // 文件大小（字节）
            const info = await FileSystem.getInfoAsync(meta.uri);
            if (info.exists && typeof info.size === 'number') {
              totalSize += info.size;
            }
          } else if (meta && meta.__chunked && typeof meta.parts === 'number') {
            // 分片：合计各片长度（按 UTF-16 长度估算 *2 字节）
            const keys = Array.from({ length: meta.parts }, (_, i) => novelPartKey(id, i));
            const pairs = await AsyncStorage.multiGet(keys);
            pairs.forEach(([, v]) => { if (v) totalSize += v.length * 2 });
          } else if (typeof base === 'string') {
            // 旧格式：整对象字符串
            totalSize += base.length * 2;
          }
        } catch {
          // 不是 JSON，按字符串估算
          totalSize += base.length * 2;
        }
      }
    }
    
    // 计算章节数据大小（估算）
    const allKeys = await AsyncStorage.getAllKeys();
    const chapterKeys = allKeys.filter(key => key.startsWith(STORAGE_KEY_CHAPTERS));
    const chapterPairs = await AsyncStorage.multiGet(chapterKeys);
    chapterPairs.forEach(([, value]) => {
      if (value) totalSize += value.length * 2;
    });

    // 累加章节正文文件夹下的实际文件大小
    try {
      const dirInfo = await FileSystem.getInfoAsync(CHAPTER_FILE_DIR);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(CHAPTER_FILE_DIR);
        for (const f of files) {
          const info = await FileSystem.getInfoAsync(CHAPTER_FILE_DIR + f);
          if (info.exists && typeof info.size === 'number') totalSize += info.size;
        }
      }
    } catch (_) {}
    
    // 转换为MB（1MB = 1024 * 1024 字节）
    const estimatedSizeMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100
    
    return { estimatedSizeMB: estimatedSizeMB || 0 }
  } catch (e) {
    console.error('获取存储信息失败', e)
    return { estimatedSizeMB: 0 }
  }
}

/**
 * 检查存储空间状态
 * @param {number} thresholdMB - 警告阈值（MB），默认0表示使用自动阈值
 * @returns {Promise<{level: string, message: string}>}
 */
export const checkStorageSpace = async (thresholdMB = 0) => {
  try {
    const info = await getStorageInfo()
    const sizeMB = info.estimatedSizeMB
    
    // 自动阈值：50MB警告，100MB危险
    const warningThreshold = thresholdMB > 0 ? thresholdMB : 50
    const dangerThreshold = thresholdMB > 0 ? thresholdMB * 2 : 100
    
    if (sizeMB >= dangerThreshold) {
      return {
        level: 'danger',
        message: `存储空间使用量已达到 ${sizeMB.toFixed(2)}MB，接近危险阈值 ${dangerThreshold}MB。建议及时清理数据。`
      }
    } else if (sizeMB >= warningThreshold) {
      return {
        level: 'warning',
        message: `存储空间使用量已达到 ${sizeMB.toFixed(2)}MB，建议定期清理不必要的数据。`
      }
    } else {
      return {
        level: 'ok',
        message: `存储空间使用正常（${sizeMB.toFixed(2)}MB）`
      }
    }
  } catch (e) {
    console.error('检查存储空间失败', e)
    return {
      level: 'ok',
      message: '无法检查存储空间状态'
    }
  }
}

/**
 * 清理存储空间（删除备份数据等）
 * @returns {Promise<boolean>}
 */
export const cleanupStorage = async () => {
  try {
    // 1) 清理旧的章节正文元信息键，避免大量键填满 SQLite
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const chapterMetaKeys = allKeys.filter(k => k.startsWith(CHAPTER_CONTENT_KEY_PREFIX));
      if (chapterMetaKeys.length > 0) {
        await AsyncStorage.multiRemove(chapterMetaKeys);
        console.log(`已清理章节正文元信息键 ${chapterMetaKeys.length} 个`);
      }
    } catch (e) {
      console.warn('清理章节元信息键失败', e);
    }

    // 2) 清理多余小说分片中残留的空片（保守，不删除有效小说数据）
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const partKeys = allKeys.filter(k => /novel_\d+_part_\d+/.test(k));
      // 无法知道对应的 parts 上限，这里不贸然删除，交由 saveNovelChunked 内的 cleanupNovelChunks 控制
      // 仅统计日志
      if (partKeys.length) console.log(`发现小说历史分片键 ${partKeys.length} 个（将按保存时逐步清理）`);
    } catch (_) {}

    // 3) 可选：清理旧备份（保留最近 N 份）
    try {
      await ensureBackupDirExists();
      const files = await FileSystem.readDirectoryAsync(backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort((a, b) => (a < b ? 1 : -1));
      if (backupFiles.length > MAX_BACKUP_FILES) {
        const toDelete = backupFiles.slice(MAX_BACKUP_FILES);
        for (const f of toDelete) {
          await FileSystem.deleteAsync(backupDir + f, { idempotent: true });
        }
        console.log(`已清理旧备份 ${toDelete.length} 个`);
      }
    } catch (e) {
      console.warn('清理备份失败', e);
    }

    console.log('存储清理完成')
    return true
  } catch (e) {
    console.error('清理存储空间失败', e)
    return false
  }
}

/**
 * 章节压力测试 - 用于测试大量章节的增删性能
 * @param {Object} options - 测试选项
 * @param {string} [options.novelId] - 小说ID，不传则使用第一本小说
 * @param {string} [options.volumeId] - 卷ID，不传则使用第一卷
 * @param {number} [options.rounds=5] - 测试轮数
 * @param {number} [options.chaptersPerRound=20] - 每轮创建的章节数
 * @param {number} [options.contentLength=8000] - 每个章节的内容长度（字符数）
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const stressTestChapters = async ({
  novelId = null,
  volumeId = null,
  rounds = 5,
  chaptersPerRound = 20,
  contentLength = 8000,
} = {}) => {
  try {
    console.log('开始章节压力测试...', { novelId, volumeId, rounds, chaptersPerRound, contentLength })
    
    // 加载小说数据
    const novels = await loadNovels()
    if (!novels || novels.length === 0) {
      return {
        success: false,
        message: '书架为空，无法进行压力测试'
      }
    }
    
    // 确定要测试的小说和卷
    let targetNovel = novelId 
      ? novels.find(n => n.id === novelId)
      : novels[0]
    
    if (!targetNovel) {
      return {
        success: false,
        message: '找不到指定的小说'
      }
    }
    
    // 确保有 volumes 数组
    if (!targetNovel.volumes || targetNovel.volumes.length === 0) {
      // 如果没有卷，创建一个
      targetNovel.volumes = [{
        id: Date.now().toString(),
        title: '第一卷',
        chapters: []
      }]
    }
    
    let targetVolume = volumeId
      ? targetNovel.volumes.find(v => v.id === volumeId)
      : targetNovel.volumes[0]
    
    if (!targetVolume) {
      return {
        success: false,
        message: '找不到指定的卷'
      }
    }
    
    // 确保有 chapters 数组
    if (!targetVolume.chapters) {
      targetVolume.chapters = []
    }

    // 生成测试内容
    const generateTestContent = (length) => {
      const chars = '这是一个测试章节内容。'.repeat(Math.ceil(length / 10))
      return chars.substring(0, length)
    }
    
    // 执行压力测试
    const createdChapterIds = []
    
    for (let round = 0; round < rounds; round++) {
      console.log(`压力测试第 ${round + 1}/${rounds} 轮开始...`)
      
      // 检查存储空间
      const storageCheck = await checkStorageSpace(0)
      if (storageCheck.level === 'danger') {
        console.warn('存储空间不足，提前结束压力测试')
        return {
          success: false,
          message: `存储空间不足，在第 ${round + 1} 轮提前结束。当前存储：${(await getStorageInfo()).estimatedSizeMB}MB`
        }
      }
      
      // 创建章节
      const roundStartTime = Date.now()
      for (let i = 0; i < chaptersPerRound; i++) {
        const chapterId = `stress_${Date.now()}_${round}_${i}`
        const chapter = {
          id: chapterId,
          title: `压力测试章节 ${round + 1}-${i + 1}`,
          content: generateTestContent(contentLength),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        targetVolume.chapters.push(chapter)
        createdChapterIds.push(chapterId)
      }

      // 保存小说数据
      const novelIndex = novels.findIndex(n => n.id === targetNovel.id)
      if (novelIndex !== -1) {
        novels[novelIndex] = targetNovel
      } else {
        novels.push(targetNovel)
      }
      await saveNovels(novels)
      
      const roundEndTime = Date.now()
      console.log(`第 ${round + 1} 轮完成：创建了 ${chaptersPerRound} 个章节，耗时 ${roundEndTime - roundStartTime}ms`)
      
      // 删除部分章节（保留一半，模拟真实场景）
      const deleteCount = Math.floor(chaptersPerRound / 2)
      if (deleteCount > 0 && createdChapterIds.length >= deleteCount) {
        const toDelete = createdChapterIds.splice(0, deleteCount)
        targetVolume.chapters = targetVolume.chapters.filter(
          ch => !toDelete.includes(ch.id)
        )
        
        // 再次保存
        const novelIndex2 = novels.findIndex(n => n.id === targetNovel.id)
        if (novelIndex2 !== -1) {
          novels[novelIndex2] = targetNovel
        }
        await saveNovels(novels)
        
        console.log(`第 ${round + 1} 轮：删除了 ${deleteCount} 个章节`)
      }
    }

    console.log('压力测试完成！')
    return {
      success: true,
      message: `压力测试完成：共 ${rounds} 轮，每轮创建 ${chaptersPerRound} 个章节`
    }
  } catch (e) {
    console.error('压力测试失败', e)
    return {
      success: false,
      message: `压力测试失败：${e.message || '未知错误'}`
    }
  }
}

/**
 * 从TXT文件内容导入小说
 * @param {string} txtContent - TXT文件内容
 * @param {string|null} novelTitle - 小说标题（可选，如果不提供则从内容推断）
 * @returns {Promise<Object>} 新创建的小说对象
 */
export const importNovelFromTxt = async (txtContent, novelTitle = null) => {
  try {
    if (!txtContent || txtContent.trim().length === 0) {
      throw new Error('文件内容为空')
    }

    // 确定小说标题
    let title = novelTitle || '导入的小说'
    if (!title || title.trim() === '') {
      title = '导入的小说'
    }

    // 卷识别
    const volumePattern = /^第[一二三四五六七八九十百千万\d]+卷[^\n]*/gm
    const volumeMatches = [...txtContent.matchAll(volumePattern)]
    const volumes = []

    if (volumeMatches.length > 0) {
      // 有卷模式
      for (let i = 0; i < volumeMatches.length; i++) {
        const volumeMatch = volumeMatches[i]
        const originalVolumeTitle = volumeMatch[0].trim()

        // 移除卷编号/前缀，只保留卷名
        const volumePrefixRegex = /^第[一二三四五六七八九十百千万\d]+卷\s*/
        let finalVolumeTitle = originalVolumeTitle.replace(volumePrefixRegex, '').trim()

        // 如果移除前缀后卷名为空，则保留原始标题（例如，保留“第一卷”）
        if (finalVolumeTitle === '') {
          finalVolumeTitle = originalVolumeTitle
        }

        const volumeStart = volumeMatch.index
        const volumeEnd = i < volumeMatches.length - 1 ? volumeMatches[i + 1].index : txtContent.length
        const volumeContent = txtContent.substring(volumeStart, volumeEnd)

    // 解析章节
    // 支持多种章节标题格式：
    // - 第X章 标题
    // - 第X卷 第Y章 标题
    // - 第一章 标题
    // - 第一卷 第一章 标题
    // - Chapter X 标题
    // - ▶ ASSISTANT: 
    const chapters = []
    let chapterNumber = 1

   // 章节识别逻辑
    const assistantStrictPattern = /^[\t \uFEFF]*(?:[\u25B6\u25BA]\uFE0F?)\s*ASSISTANT[：:]/gim
    let matches = []
    const assistantStrictMatches = [...volumeContent.matchAll(assistantStrictPattern)]
    if (assistantStrictMatches.length > 0) {
      const assistantGeneralPattern = /^[\t \uFEFF]*(?:[\u25B6\u25BA]\uFE0F?)?\s*ASSISTANT[：:][^\n]*/gim
      matches = [...volumeContent.matchAll(assistantGeneralPattern)]
    } else {
      const fallbackPatterns = [
        /第[一二三四五六七八九十百千万\d]+卷[^\n]*第[一二三四五六七八九十百千万\d]+章[^\n]*/g,
        /第[一二三四五六七八九十百千万\d]+章[^\n]*/g,
        /Chapter\s+\d+[^\n]*/gi,
        /第[一二三四五六七八九十百千万\d]+节[^\n]*/g,
      ]
      for (const p of fallbackPatterns) {
        const m = [...volumeContent.matchAll(p)]
        if (m.length > 0) {
          matches = m
          break
        }
      }
    }


        if (matches.length > 0) {
          for (let j = 0; j < matches.length; j++) {
            const match = matches[j]
            // 注意：这里的 chapterStart 和 chapterEnd 是相对于 volumeContent 的
            const chapterStart = match.index + match[0].length
            const chapterEnd = j < matches.length - 1 ? matches[j + 1].index : volumeContent.length
            
            const titleLine = match[0].trim()
            const isAssistantLine = /^\s*(?:[\u25B6\u25BA>»\-]\uFE0F?)?\s*ASSISTANT[：:]/i.test(titleLine)
            
            let chapterTitle = ''
            if (!isAssistantLine) {
              chapterTitle = titleLine
                .replace(/^第[一二三四五六七八九十百千万\d]+卷\s*/, '')
                .replace(/^第[一二三四五六七八九十百千万\d]+章\s*/, '')
                .replace(/^第[一二三四五六七八九十百千万\d]+节\s*/, '')
                .replace(/^Chapter\s+\d+\s*/i, '')
                .trim()
            }
            
            if (!chapterTitle) {
              chapterTitle = `第${chapterNumber}章`
            }
            
            const chapterContent = volumeContent.substring(chapterStart, chapterEnd).trim()

            if (chapterContent.length > 0) {
              chapters.push({
                id: `import_${Date.now()}_${i}_${chapterNumber}`,
                title: chapterTitle,
                content: chapterContent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              chapterNumber++
            }
          }
        }

        // 如果卷内有章节，则添加该卷
        if (chapters.length > 0) {
          volumes.push({
            id: `volume_${Date.now()}_${i}`,
            title: finalVolumeTitle,
            chapters: chapters,
          })
        }
      }
    } else {
      // 无卷模式（保持原有逻辑）
      const chapters = []
      let chapterNumber = 1

      // 先判断是否存在“▶ ASSISTANT:”触发模式（优先使用ASSISTANT模式贯穿全文）
      const assistantStrictPattern = /^[\t \uFEFF]*(?:[\u25B6\u25BA]\uFE0F?)\s*ASSISTANT[：:]/gim
      let matches = []
      const assistantStrictMatches = [...txtContent.matchAll(assistantStrictPattern)]
      if (assistantStrictMatches.length > 0) {
        // ASSISTANT模式：匹配带或不带▶/►的 ASSISTANT 行
        const assistantGeneralPattern = /^[\t \uFEFF]*(?:[\u25B6\u25BA]\uFE0F?)?\s*ASSISTANT[：:][^\n]*/gim
        matches = [...txtContent.matchAll(assistantGeneralPattern)]
      } else {
        // 其他模式：依序选择 第卷章 / 第章 / Chapter / 第节
        const fallbackPatterns = [
          /第[一二三四五六七八九十百千万\d]+卷[^\n]*第[一二三四五六七八九十百千万\d]+章[^\n]*/g,
          /第[一二三四五六七八九十百千万\d]+章[^\n]*/g,
          /Chapter\s+\d+[^\n]*/gi,
          /第[一二三四五六七八九十百千万\d]+节[^\n]*/g,
        ]
        for (const p of fallbackPatterns) {
          const m = [...txtContent.matchAll(p)]
          if (m.length > 0) {
            matches = m
            break
          }
        }
      }

      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i]
          const chapterStart = match.index + match[0].length
          const chapterEnd = i < matches.length - 1 ? matches[i + 1].index : txtContent.length
          
          // 提取章节标题
          const titleLine = match[0].trim()
          const isAssistantLine = /^\s*(?:[\u25B6\u25BA>»\-]\uFE0F?)?\s*ASSISTANT[：:]/i.test(titleLine)
          
          // 当为 ASSISTANT 行时，无论后面是否有文字，一律使用默认标题“第X章”
          let chapterTitle = ''
          if (!isAssistantLine) {
            // 移除章节编号/前缀，保留标题
            chapterTitle = titleLine
              .replace(/^第[一二三四五六七八九十百千万\d]+卷\s*/, '')
              .replace(/^第[一二三四五六七八九十百千万\d]+章\s*/, '')
              .replace(/^第[一二三四五六七八九十百千万\d]+节\s*/, '')
              .replace(/^Chapter\s+\d+\s*/i, '')
              .trim()
          }
          
          // 如果标题为空，使用默认标题
          if (!chapterTitle) {
            chapterTitle = `第${chapterNumber}章`
          }
          
          // 提取章节内容
          const chapterContent = txtContent.substring(chapterStart, chapterEnd).trim()

          if (chapterContent.length > 0) {
            chapters.push({
              id: `import_${Date.now()}_${Math.floor(Math.random()*1e9)}`,
              title: chapterTitle,
              content: chapterContent,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            chapterNumber++
          }
        }
      }

      // 如果没有找到章节分隔符，将整个内容作为一章
      if (chapters.length === 0) {
        chapters.push({
          id: `import_${Date.now()}_${Math.floor(Math.random()*1e9)}`,
          title: '第一章',
          content: txtContent.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      
      // 将所有章节放入一个默认卷
      volumes.push({
        id: `volume_${Date.now()}`,
        title: '第一卷',
        chapters: chapters,
      })
    }

    // 如果解析后没有任何卷（例如，只有卷标题但没有章节内容），则创建一个空卷
    if (volumes.length === 0) {
        volumes.push({
            id: `volume_${Date.now()}`,
            title: '第一卷',
            chapters: [{
                id: `import_${Date.now()}_${Math.floor(Math.random()*1e9)}`,
                title: '第一章',
                content: txtContent.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }],
        });
    }

    // 将章节正文落盘为文件，并从章节元数据中移除 content，显著降低小说体积
    try {
      // 简易并发控制，避免成百上千章节时串行耗时过长
      const runWithConcurrency = async (items, limit, worker) => {
        const q = [...items]
        const runners = Array.from({ length: Math.min(limit, q.length) }, async () => {
          while (q.length > 0) {
            const item = q.shift()
            try { await worker(item) } catch (e) { /* 不中断其它任务 */ }
          }
        })
        await Promise.all(runners)
      }

      for (const v of volumes) {
        const chapters = (v.chapters || []).slice()
        await runWithConcurrency(chapters, 4, async (ch) => {
          if (typeof ch.content === 'string') {
            await saveChapterContent(ch.id, ch.content)
            delete ch.content
          }
        })
      }
    } catch (e) {
      console.warn('导入小说：写入章节正文文件时出错', e)
    }

    // 创建小说对象
    const novel = {
      id: Date.now().toString(),
      title: title.trim(),
      description: '',
      status: '草稿',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      volumes: volumes,
    }

    // 保存小说
    const novels = await loadNovels()
    novels.push(novel)
    await saveNovels(novels)

    return novel
  } catch (e) {
    console.error('导入小说失败', e)
    throw new Error(`导入失败：${e.message || '未知错误'}`)
  }
}

/**
 * 导出小说为TXT格式
 * @param {string} novelId - 小说ID
 * @returns {Promise<string>} TXT格式的小说内容
 */
export const exportNovelToTxt = async (novelId) => {
  try {
    const novels = await loadNovels()
    const novel = novels.find(n => n.id === novelId)

    if (!novel) {
      throw new Error('找不到指定的小说')
    }

    let txtContent = `《${novel.title}》\n\n`

    // 添加简介
    if (novel.description && novel.description.trim()) {
      txtContent += `简介：${novel.description}\n\n`
    }

    txtContent += '='.repeat(50) + '\n\n'

    let volumeIndex = 1; // 初始化卷计数器
    let chapterIndex = 1; // 初始化章节计数器
    // 用于检测标题是否已包含编号的正则表达式
    const volumePrefixRegex = /^(?:第[一二三四五六七八九十百千万\d]+卷\s*)/i;
    const chapterPrefixRegex = /^(?:第[一二三四五六七八九十百千万\d]+[卷章节]\s*|Chapter\s+\d+\s*)/i;

    // 遍历所有卷和章节
    if (novel.volumes && novel.volumes.length > 0) {
      for (const volume of novel.volumes) {
        // 如果有多个卷，添加卷标题
        if (novel.volumes.length > 1) {
          let finalVolumeTitle = volume.title;
          // 如果卷标题不包含编号，则添加
          if (!volumePrefixRegex.test(finalVolumeTitle)) {
            finalVolumeTitle = `第${volumeIndex}卷 ${finalVolumeTitle}`;
          }
          txtContent += `${finalVolumeTitle}\n\n`;
        }
        volumeIndex++; // 递增卷计数

        // 添加章节内容
        if (volume.chapters && volume.chapters.length > 0) {
          for (const chapter of volume.chapters) {
            let finalChapterTitle = chapter.title;
            // 如果标题不包含编号，则添加
            if (!chapterPrefixRegex.test(finalChapterTitle)) {
              finalChapterTitle = `第${chapterIndex}章 ${finalChapterTitle}`;
            }
            
            const chapterText = await getChapterContent(chapter.id);
            txtContent += `${finalChapterTitle}\n\n`
            txtContent += `${chapterText || ''}\n\n`
            txtContent += '-'.repeat(30) + '\n\n'
            
            chapterIndex++; // 递增章节计数
          }
        }
      }
    } else {
      txtContent += '（暂无章节内容）\n'
    }

    return txtContent
  } catch (e) {
    console.error('导出小说失败', e)
    throw new Error(`导出失败：${e.message || '未知错误'}`)
  }
}

// --- 数据迁移和初始化 ---

/**
 * 从旧的单文件存储迁移到新的多键存储
 */
const migrateData = async () => {
  try {
    console.log('检查数据迁移需求...');
    const oldNovelsKey = 'novels';
    const oldChaptersKey = 'chapters';

    const oldNovelsJson = await AsyncStorage.getItem(oldNovelsKey);

    if (oldNovelsJson) {
      console.log('发现旧版小说数据，开始迁移...');
      const oldNovels = JSON.parse(oldNovelsJson);
      
      if (Array.isArray(oldNovels) && oldNovels.length > 0) {
        // 迁移小说数据
        await saveNovels(oldNovels);
        console.log(`成功迁移 ${oldNovels.length} 本小说。`);

        // 删除旧的小说键
        await AsyncStorage.removeItem(oldNovelsKey);
        console.log('旧的小说存储键已删除。');
      } else {
        // 如果旧数据为空或格式不正确，也直接删除
        await AsyncStorage.removeItem(oldNovelsKey);
      }
    }

    // 迁移章节数据
    const oldChaptersJson = await AsyncStorage.getItem(oldChaptersKey);
    if (oldChaptersJson) {
      console.log('发现旧版章节数据，开始迁移...');
      const oldChapters = JSON.parse(oldChaptersJson);

      if (Array.isArray(oldChapters) && oldChapters.length > 0) {
        // 按 novelId 对章节进行分组
        const chaptersByNovel = oldChapters.reduce((acc, chapter) => {
          if (chapter.novelId) {
            if (!acc[chapter.novelId]) {
              acc[chapter.novelId] = [];
            }
            acc[chapter.novelId].push(chapter);
          }
          return acc;
        }, {});

        // 为每个小说单独保存其章节列表
        for (const novelId in chaptersByNovel) {
          const key = `${oldChaptersKey}_${novelId}`;
          await AsyncStorage.setItem(key, JSON.stringify(chaptersByNovel[novelId]));
        }
        console.log(`成功迁移 ${Object.keys(chaptersByNovel).length} 个小说的章节数据。`);
      }
      // 删除旧的章节键
      await AsyncStorage.removeItem(oldChaptersKey);
      console.log('旧的章节存储键已删除。');
    }

    console.log('数据迁移检查完成。');
  } catch (e) {
    console.error('数据迁移失败', e);
    // 特别处理 CursorWindow 错误，这表示旧数据太大无法读取，迁移无法进行。
    // 在这种情况下，我们只能放弃迁移，以保证应用可以正常启动。
    if (e.message && e.message.includes('CursorWindow')) {
        console.warn('旧数据因过大无法读取，迁移被跳过。应用将使用新的存储格式。');
        // 尝试删除损坏的旧key，防止每次都尝试迁移
        try {
            await AsyncStorage.removeItem('novels');
            await AsyncStorage.removeItem('chapters');
            console.log('已尝试移除无法读取的旧存储键。');
        } catch (removeError) {
            console.error('移除旧存储键失败', removeError);
        }
    }
    // 即便迁移失败，也最好不要抛出错误阻塞应用启动
  }
};

/**
 * 初始化存储，在应用启动时调用
 */
/**
 * 删除一本小说及其所有相关数据
 * @param {string} novelId - 要删除的小说ID
 */
export const deleteNovel = async (novelId) => {
  try {
    // 0. 读取小说对象，准备清理其章节正文文件
    let novelToDelete = null;
    try {
      novelToDelete = await readNovelPossiblyChunked(novelId);
    } catch (_) {}

    // 1. 从小说ID列表中移除该ID
    const idsJson = await AsyncStorage.getItem(NOVEL_ID_LIST_KEY);
    let novelIds = idsJson ? JSON.parse(idsJson) : [];
    const updatedNovelIds = novelIds.filter(id => id !== novelId);
    await AsyncStorage.setItem(NOVEL_ID_LIST_KEY, JSON.stringify(updatedNovelIds));

    // 2. 如果是文件存储，删除对应文件
    try {
      const base = await AsyncStorage.getItem(novelKey(novelId));
      if (base) {
        try {
          const meta = JSON.parse(base);
          if (meta && meta.__file && meta.uri) {
            const info = await FileSystem.getInfoAsync(meta.uri);
            if (info.exists) {
              await FileSystem.deleteAsync(meta.uri);
              console.log(`[删除小说文件] ${meta.uri}`);
            }
          }
        } catch (_) {}
      }
    } catch (fe) {
      console.warn(`[删除小说-文件清理警告] id=${novelId} err=${fe?.message || fe}`);
    }

    // 2.1 删除该小说的所有章节正文文件
    if (novelToDelete) {
      try {
        for (const v of novelToDelete?.volumes || []) {
          for (const ch of v?.chapters || []) {
            try { await deleteChapterContent(ch.id); } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('[删除小说] 清理章节正文文件失败', e);
      }
    }

    // 3. 删除小说本身、其章节和可能的其他相关数据（含分片）
    const keysToRemove = [
      `${NOVEL_KEY_PREFIX}${novelId}`,
      `${STORAGE_KEY_CHAPTERS}_${novelId}`
    ];
    await AsyncStorage.multiRemove(keysToRemove);
    await cleanupNovelChunks(novelId, 0);

    console.log(`小说 ${novelId} 已被成功删除。`);
  } catch (e) {
    console.error(`删除小说 ${novelId} 失败`, e);
    // 在这里可以考虑一个回滚策略，但目前首先保证删除的原子性
    throw e; // 重新抛出错误，让调用方知道操作失败
  }
};

// --- 备份与恢复 ---
const backupDir = FileSystem.documentDirectory + 'backups/';
const MAX_BACKUP_FILES = 5; // 保留最近 N 份备份
const MIN_BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 小时内只备份一次

// 确保备份目录存在
const ensureBackupDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(backupDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
  }
};

/**
 * 创建一个完整的应用数据备份
 */
export const backupAllData = async () => {
  try {
    await ensureBackupDirExists();
    const novels = await loadNovels();
    
    // 如果没有小说，则不创建备份
    if (novels.length === 0) {
      console.log('没有数据可备份。');
      return;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `backup-${timestamp}.json`;
    const fileUri = backupDir + fileName;

    const backupData = {
      createdAt: new Date().toISOString(),
      version: '1.0',
      novels: novels,
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));
    console.log(`数据备份成功: ${fileName}`);
    return fileUri;
  } catch (e) {
    console.error('创建备份失败', e);
  }
};

/**
 * 列出所有可用的备份文件
 */
export const listBackups = async () => {
  try {
    await ensureBackupDirExists();
    const files = await FileSystem.readDirectoryAsync(backupDir);
    const backupFiles = files
      .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
      .map(file => {
        // 从文件名解析日期
        const timestamp = file.replace('backup-', '').replace('.json', '').replace(/-/g, ':');
        return { name: file, date: new Date(timestamp) };
      })
      .sort((a, b) => b.date - a.date); // 按日期降序排序
    return backupFiles;
  } catch (e) {
    console.error('列出备份失败', e);
    return [];
  }
};

/**
 * 从指定的备份文件恢复数据
 * @param {string} fileName - 要恢复的备份文件名
 */
export const restoreFromBackup = async (fileName) => {
  try {
    const fileUri = backupDir + fileName;
    const json = await FileSystem.readAsStringAsync(fileUri);
    const backupData = JSON.parse(json);

    if (backupData && Array.isArray(backupData.novels)) {
      // 这是一个危险操作，它会覆盖当前所有数据
      // 我们需要先清除当前的所有数据
      const currentNovels = await loadNovels();
      const keysToRemove = currentNovels.map(n => `${NOVEL_KEY_PREFIX}${n.id}`);
      await AsyncStorage.multiRemove(keysToRemove);
      
      // 使用备份数据进行保存
      await saveNovels(backupData.novels);
      console.log(`已成功从 ${fileName} 恢复数据。`);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`从备份 ${fileName} 恢复失败`, e);
    throw new Error('恢复失败，备份文件可能已损坏。');
  }
};

/**
 * 删除一个备份文件
 * @param {string} fileName - 要删除的备份文件名
 */
export const deleteBackup = async (fileName) => {
  try {
    const fileUri = backupDir + fileName;
    await FileSystem.deleteAsync(fileUri);
    console.log(`备份 ${fileName} 已被删除。`);
    return true;
  } catch (e) {
    console.error(`删除备份 ${fileName} 失败`, e);
    return false;
  }
};

/**
 * 清理孤立存储（当小说列表为空但仍占用大量存储时）
 * - 清理残留的小说分片键、指针键
 * - 清理所有章节列表键与章节正文文件
 * - 清理基于文件的小说JSON文件
 * 注意：仅当小说ID列表为空时才会执行，以避免误删
 */
export const cleanupOrphanStorage = async () => {
  try {
    const idsJson = await AsyncStorage.getItem(NOVEL_ID_LIST_KEY);
    let novelIds = [];
    try { novelIds = idsJson ? JSON.parse(idsJson) : []; } catch (_) { novelIds = []; }

    if (Array.isArray(novelIds) && novelIds.length > 0) {
      // 有小说，不清理
      return { cleaned: false, message: '存在小说数据，跳过孤立清理' };
    }

    // 1) 清理所有以 novel_ 开头的键（含分片及指针）以及旧版 novels 键
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(k => k.startsWith(NOVEL_KEY_PREFIX));
      if (keysToRemove.length) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      await AsyncStorage.removeItem('novels');
    } catch (e) {
      console.warn('清理孤立小说键失败', e);
    }

    // 2) 清理章节列表键与旧版 chapters 键、章节正文元信息键
    try {
      const allKeys2 = await AsyncStorage.getAllKeys();
      const chapterListKeys = allKeys2.filter(k => k.startsWith(`${STORAGE_KEY_CHAPTERS}_`));
      const chapterMetaKeys = allKeys2.filter(k => k.startsWith(CHAPTER_CONTENT_KEY_PREFIX));
      const removeKeys = [...chapterListKeys, ...chapterMetaKeys, 'chapters'];
      if (removeKeys.length) {
        await AsyncStorage.multiRemove(removeKeys);
      }
    } catch (e) {
      console.warn('清理章节键失败', e);
    }

    // 3) 清理章节正文文件夹
    try {
      const dirInfo = await FileSystem.getInfoAsync(CHAPTER_FILE_DIR);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(CHAPTER_FILE_DIR);
        for (const f of files) {
          try { await FileSystem.deleteAsync(CHAPTER_FILE_DIR + f, { idempotent: true }); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('清理章节文件失败', e);
    }

    // 4) 清理小说文件存储目录下的JSON文件
    try {
      await ensureNovelDirExists();
      const files = await FileSystem.readDirectoryAsync(NOVEL_FILE_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try { await FileSystem.deleteAsync(NOVEL_FILE_DIR + f, { idempotent: true }); } catch (_) {}
        }
      }
    } catch (e) {
      // 目录可能不存在，忽略
    }

    return { cleaned: true };
  } catch (e) {
    console.error('清理孤立存储失败', e);
    return { cleaned: false, error: e?.message || String(e) };
  }
};

export const initializeStorage = async () => {
  await migrateData();
  await backupAllData(); // 在应用启动时自动备份
};
