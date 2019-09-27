#!/bin/python3

import sys
import os
import re
import argparse
import fileinput
import tempfile
import shutil
from pprint import pprint
from collections import namedtuple
from multiprocessing import Pool

try:
    from tqdm import tqdm
except ImportError:
    print("Please install progress bar utility with: pip install tqdm", file=sys.stderr)
    sys.exit(1)

Rename = namedtuple('Rename', 'old new')


def chunkify(lst, n):
    # beware: sorted lists will be destroyed, e.g. chunkify(range(9), 3) => [[1,4,7],[2,5,8],[3,6,9]]
    return [lst[i::n] for i in range(n)]


def move_threaded(entries):
    for e in entries:
        print("%s -> %s" % (e[1], e[0]))
        shutil.move(e[1], e[0])


def process_substitute(content, mapping):
    if not content.startswith('include'):
        return content
    for r in mapping:
        content = content.replace(r.old, r.new)
    return content


def rename_files(mapping, path):
    for r in mapping:
        os.rename(os.path.join(path, r.old), os.path.join(path, r.new))


def substitute_contents(mapping, path):
    # if os.path.isfile(mapping[0].new):
    #     file_list = [f.new for f in mapping]
    # else:
    #     file_list = [f.old for f in mapping]
    file_list = [d for d in os.listdir(path) if d.endswith('.adoc')]

    # VANILLA
    # file_list_bkp = ["%s.bkp" % (f) for f in file_list]
    # for old, new in zip(file_list, file_list_bkp):
    #     os.rename(old, new)

    # regexes = [(re.compile(r.old), r.new) for r in mapping]

    # for idx in tqdm(range(len(file_list))):
    #     file = file_list[idx]
    #     with open(file_list_bkp[idx], 'r', encoding='utf-8') as infile, \
    #             open(file, 'w', encoding='utf-8') as outfile:
    #         for line in infile:
    #             for search, replace in regexes:
    #                 line = search.sub(replace, line)
    #             outfile.write(line)

    # SED
    # subs = ["s/%s/%s/g".replace('.', '\\.') % (r.old, r.new) for r in mapping]
    # grep_sub_str = ":".join(subs)
    # print(grep_sub_str)

    # FILEINPUT
    # for file_in in file_list:
    #     with fileinput.input(file_in, inplace=True) as f:
    #         print(f.filename())

    # TEMP FILES
    tmp = tempfile.mkdtemp(prefix='renaming_')
    file_list = [(f, os.path.join(tmp, f)) for f in file_list]
    for (file_in, tmp_file) in tqdm(file_list):
        with open(file_in, 'r', encoding='utf-8') as fin, open(tmp_file, 'w+', encoding='utf-8') as fout:
            for line in fin:
                line = process_substitute(line, mapping)
                fout.write(line)

    SIZE = 8
    pool = Pool(SIZE)
    pool.map(move_threaded, chunkify(file_list, SIZE))


def main():
    argparser = argparse.ArgumentParser(
        description="Rename all files that match the rename scheme file.")
    argparser.add_argument("--schema", required=True, help="Rename schema")
    argparser.add_argument("--separator",
                           help="Separator used in the rename schema (default: ::::)",
                           type=str, default="::::")
    argparser.add_argument("--filename", default=False,
                           action='store_true', help="Apply changes to file names")
    argparser.add_argument("--content", default=False,
                           action='store_true', help="Apply changes to file contents")
    argparser.add_argument("--debug", default=False,
                           action='store_true', help="Enable debug output")
    argparser.add_argument("--path", default=".",
                           help="Path where the files to rename are located")
    args = argparser.parse_args()

    mapping = []
    with open(args.schema, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            names = [item.strip() for item in line.split(args.separator)]
            mapping.append(Rename(names[0], names[1]))

    if args.filename and args.content:
        print("You provided both --filename and --content, \
            if you separate them and add them to your VCS you can check the changes more easily.")
        answer = input("Are you sure you want to apply both options?")
        if answer.lower() not in "y yes j ja".split():
            return
    if args.debug:
        pprint(mapping, indent=2)

    if args.filename:
        rename_files(mapping, args.path)

    if args.content:
        substitute_contents(mapping, args.path)

    if not (args.filename or args.content):
        print("You have selected no option.")


if __name__ == "__main__":
    main()
