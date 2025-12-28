# 批量生成：前缀(空格/换行) + 标点 的 tokenId 变体集合
# 用法：python tools/gen_punct_variants_token_ids.py

import json
from deepseek_tokenizer import ds_token

PUNCTS = list("，。！？；：、（）“”‘’—…")
PREFIXES = ["", " ", "\n", "\n\n"]

ids = set()
per = {}

for p in PREFIXES:
    for ch in PUNCTS:
        s = p + ch
        enc = ds_token.encode(s)
        per[repr(s)] = enc
        for t in enc:
            ids.add(t)

unique_ids = sorted(ids)

print("=== count ===")
print(len(unique_ids))
print("=== punctuationBiasTokenIds (variants) ===")
print(json.dumps(unique_ids, ensure_ascii=False))
# 如需查看每个变体：取消注释
# print(json.dumps(per, ensure_ascii=False, indent=2))



