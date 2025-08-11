import math

# Update paths
css_path_new = "./vocab_shared.css"
json_path_new = "./사랑영단어_수능_2000_class_based.json"

# Update chapter_id calculation
for item in data:
    item["chapter_id"] = math.floor((item["id"] - 1) / 40) + 1



with open("./사랑영단어_수능_2000_class_based1.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

(css_path_new, json_path_new)
