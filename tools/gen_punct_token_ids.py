# 生成 deepseek-tokenizer 对指定标点的 token id 列表
# 用法：python tools/gen_punct_token_ids.py

import json

from deepseek_tokenizer import ds_token

PUNCTS = list("，。！？；：、（）“”‘’—…")

ids = []
per_char = {}

for ch in PUNCTS:
    enc = ds_token.encode(ch)
    per_char[ch] = enc
    ids.extend(enc)

unique_ids = sorted(set(ids))

print("=== per_char ===")
print(json.dumps(per_char, ensure_ascii=False, indent=2))
print("\n=== punctuationBiasTokenIds ===")
print(json.dumps(unique_ids, ensure_ascii=False))





