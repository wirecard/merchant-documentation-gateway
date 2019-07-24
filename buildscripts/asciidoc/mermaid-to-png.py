#!/bin/python
"""
Export inline mermaid diagrams to temp files and convert these into png's
using mmdc, the mermaid cli.

To speed up the script: only pass files that contain mermaid diagrams,
use './script $(git grep -l "\[mermaid")' or './script $(grep -l "\[mermaid" *.adoc).
"""

import re
import os
import sys
import argparse
import tempfile
import subprocess

# sys.path.append(os.path.abspath('../../scripts/util/'))
# print(os.path.abspath('../../scripts/util/'))
# from colors import info, warning, error


class INFO:
    """
    Helper class for mermaid (mmd).
    """
    MMD_REGEX = re.compile(r"\[mermaid, ?([A-Za-z0-9_]+), ?(svg|png)\]")
    MMD_DELIM = "----"
    MMD_CONFIG = "config/mermaid-default-theme.json"


def main():
    parser = argparse.ArgumentParser(
        description="Extract all mermaid diagrams (in text form) and create png's. \
        To speed up the script: only pass files that contain mermaid diagrams, \
        use './script $(git grep -l \"\\[mermaid\")' or './script $(grep -l \"\\[mermaid\" *.adoc)'.")
    parser.add_argument("files", metavar="FILE", nargs="+",
                        help="Input files that contain mermaid diagrams, default=mermaid_pngs")
    parser.add_argument("-d", "--out-dir", default="mermaid_pngs",
                        help="Output directory for the mermaid diagrams")
    args = parser.parse_args()
    ###########################################################################
    # generate temp files with mermaid content
    ###########################################################################
    tempdir = tempfile.mkdtemp(prefix="mmd_")
    print("[*] Putting files in %s" % (tempdir))
    mmd_files = []

    for file in args.files:
        lines = []
        with open(file, "r", encoding="utf-8") as f:
            lines = [l.rstrip() for l in f.readlines()]

        file_name = ""
        fd = None                   # file descriptor
        in_mmd_blk = False          # in mermaid text block
        is_mmd = False              # block actually is mermaid block, not e.g. source
        open_file = False           # we have an open file descriptor
        line_cnt = 1
        for line in lines:
            if line == INFO.MMD_DELIM and is_mmd:
                # close file if mermaid block is closing
                if in_mmd_blk:
                    fd.close()
                    fd = None
                    open_file = False
                    is_mmd = False

                in_mmd_blk = not in_mmd_blk
                continue

            if in_mmd_blk and open_file:
                fd.write(line + "\n")

            result = re.match(INFO.MMD_REGEX, line)
            if result:
                is_mmd = True
                file_name = os.path.join(tempdir, result.group(1) + ".mmd")
                mmd_files.append(file_name)
                fd = open(file_name, "w+", encoding="utf-8")
                open_file = True

            line_cnt += 1

    ###########################################################################
    # generate png files from mermaid temp files
    ###########################################################################
    os.makedirs(args.out_dir, exist_ok=True)
    png_files = [os.path.join(args.out_dir,
                              os.path.basename(mmd) .split(".")[0] + ".png")
                 for mmd in mmd_files]
    commands = ["mmdc -i {in_mmd} -o {out} -c {config} -w 2000"
                .format(in_mmd=mmd,
                        out=png,
                        config=INFO.MMD_CONFIG)
                for mmd, png in zip(mmd_files, png_files)]

    subprocess.Popen(
        "bash buildscripts/asciidoc/create-mermaid-config.sh", shell=True).wait()
    for i, cmd in enumerate(commands):
        print("[*] %s" % (png_files[i].split(os.sep)[-1]))
        returncode = subprocess.call(cmd, shell=True)
        if returncode != 0:
            raise RuntimeError(
                "Call returned non-zero exit code (%d)" % (returncode))


if __name__ == "__main__":
    main()
