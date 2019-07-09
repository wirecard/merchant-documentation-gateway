#!/bin/python3
"""
asciidoctor source block exporter
typically called like:
* python3 -u exporter.py -d src-files *.adoc
or
* PYTHONUNBUFFERED="1" python3 exporter.py -d src-files *.adoc
"""

import argparse
import tempfile
import sys
import os
import re
from shutil import copyfile
from concurrent.futures import ThreadPoolExecutor


SRC_BLK_DELIM = "----"
NO_BLK_TITLE = "NoBlockTitle"


class color:
   PURPLE = '\033[95m'
   CYAN = '\033[96m'
   DARKCYAN = '\033[36m'
   BLUE = '\033[94m'
   GREEN = '\033[92m'
   YELLOW = '\033[93m'
   RED = '\033[91m'
   BOLD = '\033[1m'
   UNDERLINE = '\033[4m'
   END = '\033[0m'


def debug(msg):
    pass
    # print("# " + msg)


def info(msg):
    print(color.GREEN + "[*] " + msg + color.END)


def warning(msg):
    print(color.BOLD + color.RED + "[***] " + msg + color.END)


def normalize_header(header):
    # info("normalize input:  {}".format(header))
    new_header = re.sub(r"[\(\)<>]|XML |i\.e\.|[\.,=\"–/]",
                        "", header).replace("-", "_").replace("#", "_")
    words = re.split(r" |_", new_header)
    final_header_list = []
    if len(words) > 10:
        final_header_list = [w[0] for w in words if len(w) > 0]
    else:
        for w in words:
            if w.isupper():
                final_header_list.append("_")
            final_header_list.append(w.title() if w.islower() else w)
            if w.isupper():
                final_header_list.append("_")
    final_header = re.sub(
        r"_+", "_", "".join(final_header_list).rstrip("_").lstrip("_"))
    # info("normalize output: {}".format(final_header))
    return final_header


def dir_try_or_create(name):
    try:
        os.stat(name)
    except:
        os.makedirs(name)


###############################################################################
# BEGIN SCRIPT                                                                #
###############################################################################
parser = argparse.ArgumentParser(description="""Export script for asciidoctor source blocks in the form '[source, ext, key=value]',
where ext is the file extension (or programming language) and 'key=value' are additional attributes.""")
parser.add_argument('adocs', metavar='FILE', type=str,
                    nargs='+', help='.adoc Files to process')
parser.add_argument('-d', '--src-out-dir', default=".", type=str,
                    help='Output directory for extracted source files Default: . (current directory)', required=False)
parser.add_argument('-t', '--type', dest='extensions', default="xml,json",
                    help='Comma separated list of source code languages which shall be extracted. Default: "xml,json"', required=False)
args = parser.parse_args()

# all args are files to process
files = sorted(args.adocs)
extensions_to_extract = args.extensions.replace(" ", "").split(",")
out_dir = args.src_out_dir
debug("Processing {} files...".format(len(files)))
# temp folder for intermediate adoc files
# temp_folder = tempfile.mkdtemp()
temp_folder = os.path.join(tempfile.gettempdir(), "adoc-source-exporter")
dir_try_or_create(temp_folder)

# needed information to extract source blocks and create new files
found_source_block = False
inside_source = False
extension = None
last_header = None
block_title = None
temp_file = None


class ADOC_REGEX:
   # https://regex101.com/r/q9Puez/1
    SOURCE_BLOCK = re.compile(r"\[source, ?(\w+)(, ?([a-zA-Z0-9=_\+\"]+))?\]")
    # https://regex101.com/r/Fcun13/1
    HEADER = re.compile(r"^\[#([a-zA-Z0-9_]+)\]$")
    # https://regex101.com/r/BuiDJ9/1
    BLOCK_TITLE = re.compile(r"^\.((\d+\.)?[-a-zA-Z0-9_ ()<>,=\.\"–/'#]+):?$")


fname_id = 1

# for each input adoc file, we create a temporary file in a tempfolder.
# these will be copied back later on
temp_files = [os.path.join(temp_folder, os.path.basename(filename))
              for filename in files]
used_file_names = set()

###############################################################################
# BEGIN PROCESSING                                                            #
###############################################################################
# 1. if we find a source block of form `[source, <extension>]`,
# go into found_source_block state and remember extension.
# 2. if we find `====` go into inside_source state.
# 2.5. if we find an include, assume we already replaced this source block,
# do nothing, go into include_found state and continue.
# 3. if we didn't find an include, open the new source file,
# and write to it line by line.
###############################################################################
for (file_in, file_out) in zip(files, temp_files):
    debug("Processing {}".format(file_in))
    # reset variables
    contains_src = False
    include_found = False
    last_header = None
    block_title = NO_BLK_TITLE

    file_name = None
    temp_src_file = None
    with open(file_in, "r", encoding='utf8') as f_input:
        with open(file_out, "w+", encoding='utf8') as f_output:
            line_count = 0
            for line in f_input.readlines():
                # if we find an include, just leave it and continue
                if inside_source and "include" in line:
                    include_found = True
                    line_count += 1
                    f_output.write(line)
                    # don't forget to remember the used filename to avoid collisions
                    file_name = line.replace("include::", "").replace("[]", "")
                    used_file_names.add(file_name)
                    continue

                # set last_header if this line is a header
                result = re.match(ADOC_REGEX.HEADER, line.rstrip())
                if result:
                    last_header = normalize_header(result.group(1))
                # set block title if this line is the title
                result = re.match(ADOC_REGEX.BLOCK_TITLE, line.rstrip())
                if result:
                    block_title = normalize_header(result.group(1))

                # close newly created source file once source block is read completely
                # and write include statement to .adoc
                if line.rstrip() == SRC_BLK_DELIM and inside_source:
                    inside_source = False
                    found_source_block = False
                    if not include_found:
                        contains_src = True
                        debug("finish {}: {}".format(last_header, block_title))
                        block_title = NO_BLK_TITLE
                        f_output.write("include::{}[]\n".format(
                            temp_src_file.name.replace('\\', '/')))
                        line_count += 1
                        temp_src_file.close()
                        temp_src_file = None

                # output file 1:1 unless we have a source block
                if not inside_source or include_found:
                    line_count += 1
                    f_output.write(line)
                else:
                    if temp_src_file is None:
                        debug("Creating {}".format(file_name))
                        temp_src_file = open(file_name, "w+", encoding="utf8")
                    temp_src_file.write(line)

                # line is "----" and we found a source block header, we're now inside the source
                if line.rstrip() == SRC_BLK_DELIM and found_source_block and not inside_source:
                    inside_source = True
                    include_found = False

                # find extension in source block header
                result = re.match(ADOC_REGEX.SOURCE_BLOCK, line)
                if result:
                    extension = result.group(1)
                    if extension not in extensions_to_extract:
                        continue
                    debug("found source block {}".format(extension))
                    found_source_block = True

                    dir_try_or_create(os.path.join(out_dir, extension))
                    # only use last_header as filename if no block is detected
                    # and let the id mechanism watch out for name collisions
                    if block_title == NO_BLK_TITLE:
                        warning("[line:{0:5}] No block title: {1}".format(
                            line_count, file_in))
                        fbase_name = last_header
                    else:
                        fbase_name = "_".join([last_header, block_title])
                    file_name = os.path.join(
                        out_dir, extension, ".".join([fbase_name, extension]))

                    # check for conflicting filenames and append id if necessary
                    while file_name in used_file_names:
                        indexed_fbase_name = "{}_{}".format(
                            fbase_name, fname_id)
                        fname_id += 1
                        file_name = os.path.join(
                            out_dir, extension, ".".join([indexed_fbase_name, extension]))

                    used_file_names.add(file_name)

    if not contains_src:
        os.remove(file_out)

with ThreadPoolExecutor(max_workers=8) as executor:
    for (file_in, file_out) in zip(files, temp_files):
        if os.path.isfile(file_out):
            executor.submit(copyfile, file_out, file_in)
