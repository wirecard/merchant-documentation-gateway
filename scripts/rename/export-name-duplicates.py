#!/bin/python3

import os
import json
from shutil import copyfile, rmtree
from tempfile import gettempdir

def pjoin(*args):
    return "/".join([*args])

FILE = "no-track/name_conflicts.json"

conflicts = {}
with open(FILE, "r", encoding="utf8") as f:
    conflicts = json.load(f)

output_dir = os.path.join(gettempdir().replace("\\", "/"), "conflict-files")
if os.path.exists(output_dir):
    rmtree(output_dir)
os.makedirs(output_dir, exist_ok=True)

for (conflict_file, input_list) in [(k, [e.split("/")[-1] for e in v])
                                    for k, v in conflicts.items()]:
    folder = pjoin(output_dir, conflict_file.split(".")[0].split("/")[-1])
    os.makedirs(folder)
    for input_file in input_list:
        # print(os.path.join("samples", "xml", input_file),
        #     os.path.join(folder, input_file))
        copyfile(pjoin("samples", "xml", input_file),
                 pjoin(folder, input_file))
