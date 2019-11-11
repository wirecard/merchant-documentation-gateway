#!/bin/python3

import sys
import argparse
import os
from collections import namedtuple

Entry = namedtuple('Entry', 'name cardinality format size description')

def main():
    ### ARGS
    parser = argparse.ArgumentParser(description="Convert old field tables to more modern ones")
    parser.add_argument("file", help="File containing the table")
    parser.add_argument("--dev", help="Enable developer mode (e.g. link stylesheet)", default=False, action="store_true", required=False)
    parser.add_argument("--overwrite", help="Overwrite the original file with the new content", default=False, action="store_true", required=False)
    args = parser.parse_args()
    ### MAIN
    preamble = []
    entries = []
    entry = None
    start = False
    # for line in map(str.rstrip, sys.stdin):
    with open(args.file, 'r', encoding='utf8') as table_f:
        for line in map(str.rstrip, table_f):
            ### handle table start and end
            if not start:
                # start of table
                if line.count('|') > 1:
                    start = True
                else:
                    preamble.append(line)
                continue
            else:
                # end of table
                if line.count('|') == 1:
                    entries.append(entry)
                    continue
                    
            if line.startswith('|'):
                if entry is not None:
                    # entry.description = "\n".join(entry.description)
                    entries.append(entry)
                cells = list(map(str.rstrip, line.split('|')))[1:] # remove first cell (empty)
                assert len(cells) == 5, "length is %d (should be 5)" % (len(cells))
                name, cardinality, fmt, size, descrptn = cells
                entry = Entry(name=name, cardinality=cardinality, format=fmt, size=size, description=[])
                entry.description.append(descrptn)
            else:
                entry.description.append(line)
                print("appending: " + line)

    if args.overwrite:
        new_file = args.file
    else:
        new_file = args.file.split('.')[0] + "_new.adoc"
    # for e in entries:
    #     print(e)
    with open(new_file, 'w+', encoding='utf8') as new_tbl_f:
        if args.dev:
            new_tbl_f.write(":stylesdir: css\n:stylesheet: main.css\n")
        new_tbl_f.write("\n".join(preamble))
        new_tbl_f.write("\n")
        new_tbl_f.write("[.field-table]\n")
        new_tbl_f.write("|===\n")
        new_tbl_f.write("|Field Information |Description\n")
        new_tbl_f.write("\n")
        for entry in entries:
            size = entry.size
            if size.endswith(' a'):
                size = size[:-2]
            new_tbl_f.write("|")
            new_tbl_f.write(
                "``{name}`` {size} **{cardinality}**\n".format(
                    name=entry.name, size=size, cardinality=entry.cardinality,
                ))
            new_tbl_f.write("__{format}__\n".format(format=entry.format))
            new_tbl_f.write("a|{description}\n".format(description="\n".join(entry.description)))
            # new_tbl_f.write("a|{description}\n".format(description="\n".join(entry.description)))
        new_tbl_f.write("|===\n")
    if args.dev:
        os.system('asciidoctor -a linkcss test_tbl_new.adoc')


if __name__ == "__main__":
    main()