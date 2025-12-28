from deepseek_tokenizer import ds_token

# 单字符
chars = list("，。！？；：、（）“”‘’—…")
for ch in chars:
    print(repr(ch), ds_token.encode(ch))

print('---')
# 连续字符串
s = "，。！？；：、（）“”‘’—…"
print(ds_token.encode(s))

print('---')
# 常见组合：前面可能出现空格/换行
for prefix in ["", " ", "\n", "\n\n"]:
    t = prefix + "，"
    print(repr(t), ds_token.encode(t))




