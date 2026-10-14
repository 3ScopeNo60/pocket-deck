"""Turn the single-file Vite build into an Artifact page: drop the document wrapper
(the Artifact publisher adds its own) and put the <title> first."""
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
title = re.search(r"<title>.*?</title>", head, re.S).group(0)
head = head.replace(title, "")
head = re.sub(r'<meta (charset|name="viewport")[^>]*>', "", head)
open(dst, "w", encoding="utf-8").write(title + "\n" + head + "\n" + body)
print("wrote", dst)
