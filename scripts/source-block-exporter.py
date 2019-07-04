#!/bin/python3
"""
asciidoctor source block exporter
typically called like: python3 exporter.py -d src-files *.adoc
TODO: skip already exported blocks
"""

import argparse
import tempfile
import sys
import os
import re
from shutil import copyfile
from concurrent.futures import ThreadPoolExecutor

SRC_BLK_DELIM = "----"


def debug(msg):
    pass
    # print("# " + msg)


def info(msg):
    print("[*] " + msg)


def normalize_header(header):
    return re.sub(r"[\(\)]|XML ", "", header).replace(' ', '_')


def dir_try_or_create(name):
    try:
        os.stat(name)
    except:
        os.makedirs(name)


###############################################################################
# BEGIN SCRIPT
###############################################################################
parser = argparse.ArgumentParser()
parser.add_argument('adocs', metavar='FILE', type=str,
                    nargs='+', help='.adoc Files to process')
parser.add_argument('-d', '--src-out-dir', default="", type=str,
                    help='Output directory for extracted source files', required=False)
parser.add_argument('-t', '--type', dest='extensions', default="xml,json",
                    help='Coma separated list of source code languages which shall be extracted', required=False)
args = parser.parse_args()

# all args are files to process
files = sorted(args.adocs)
extensions_to_extract = args.extensions.replace(" ", "").split(",")
out_dir = args.src_out_dir
info("Processing {} files...".format(len(files)))
# temp folder for intermediate adoc files
# temp_folder = tempfile.mkdtemp()
temp_folder = os.path.join(tempfile.gettempdir(), "adoc-source-exporter")
dir_try_or_create(temp_folder)

# needed information to extract source blocks and create new files
found_source_block = False
inside_source = False
extension = None
# https://regex101.com/r/q9Puez/1
adoc_src_blk_regex = re.compile(r"\[source, ?(\w+)\]")
last_header = None
# https://regex101.com/r/Fcun13/1
adoc_header_regex = re.compile(r"^\[#([a-zA-Z0-9_]+)\]$")
# https://regex101.com/r/BuiDJ9/1
block_title = None
adoc_block_title_regex = re.compile(r"^\.([a-zA-Z0-9_ ()]+)$")
temp_file = None

# for each input adoc file, we create a temporary file in a tempfolder.
# these will be copied back later on
temp_files = [os.path.join(temp_folder, os.path.basename(filename))
              for filename in files]

for (file_in, file_out) in zip(files, temp_files):
    info("Processing {}".format(file_in))
    contains_src = False
    with open(file_in, "r", encoding='utf8') as f_input:
        with open(file_out, "w+", encoding='utf8') as f_output:
            for line in f_input.readlines():
                if inside_source and "include" in line:
                    pass # TODO: skip if include is found in source block

                # set last_header if this line is a header
                result = re.match(adoc_header_regex, line.rstrip())
                if result:
                    last_header = result.group(1)
                    debug("found header {}".format(last_header))
                # set block title if this line is the title
                result = re.match(adoc_block_title_regex, line.rstrip())
                if result:
                    block_title = normalize_header(result.group(1))
                    debug("found title {}".format(block_title))

                # close newly created source file once source block is read completely
                # and write include statement to .adoc
                if line.rstrip() == SRC_BLK_DELIM and inside_source:
                    debug("finish {}".format(last_header))
                    inside_source = False
                    found_source_block = False
                    f_output.write("include::{}[]\n".format(
                        temp_src_file.name.replace('\\', '/')))
                    temp_src_file.close()

                # output file 1:1 unless we have a source block
                if not inside_source:
                    f_output.write(line)
                else:
                    temp_src_file.write(line)

                # line is "----" and we found a source block header, we're now inside the source
                if line.rstrip() == SRC_BLK_DELIM and found_source_block and not inside_source:
                    inside_source = True
                    contains_src = True

                # find extension in source block header
                result = re.match(adoc_src_blk_regex, line)
                if result:
                    extension = result.group(1)
                    if extension not in extensions_to_extract:
                        continue
                    debug("found source block {}".format(extension))
                    found_source_block = True

                    dir_try_or_create(os.path.join(out_dir, extension))
                    file_name = os.path.join(
                        out_dir, extension,
                        ".".join(["_".join([last_header, block_title]), extension]))
                    debug("Creating {} source file {}".format(
                        extension, file_name))
                    temp_src_file = open(file_name, "w+", encoding="utf8")
    if not contains_src:
        os.remove(file_out)

executor = ThreadPoolExecutor(max_workers=8)
for (file_in, file_out) in zip(files, temp_files):
    if os.path.isfile(file_out):
        executor.submit(copyfile(file_out, file_in))
