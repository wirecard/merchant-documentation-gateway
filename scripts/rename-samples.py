#!/bin/python3

import xml.etree.ElementTree as ET
import argparse
import json
import os
import tempfile
from colors import color, error

# NOTE: instead of root.getchildren() use list(root)
# NOTE: print with ET.dump(<root>)

SUPPORTED_FILETYPES = "xml json".split()
OPERATION_KEYWORDS = "failure success".split()
REPORT_FILE_NAME = "report-rename.json"
ERROR_REPORT_FILE_NAME = "errors.json"
ERRORS = {"errors": []}


def remove_namespace(root):
    root.tag = root.tag[root.tag.find('}')+1:]
    for child in list(root):
        remove_namespace(child)


def read_mixed_file(file_name):
    with open(file_name, "r", encoding="utf8") as f:
        found_beginning = False
        header = []
        xml = []
        for line in f:
            if line.startswith("<"):
                found_beginning = True
            if found_beginning:
                xml.append(line.rstrip())
            else:
                header.append(line.rstrip())

    return ("\n".join(header), "\n".join(xml) if xml else None)


def process_file_name(file_name, header_dict=None):
    """Take a file name and return the new adapted file name + possible header information.

    Return: (new_file_name, header_file_name)
    """
    if not any(file_name.endswith(ext) for ext in SUPPORTED_FILETYPES):
        raise ValueError("Unsupported file extension: must be one of {}".format(
            ",".join(SUPPORTED_FILETYPES)))

    # skip all responses and android xml
    if any((keyword in file_name.lower()) for keyword in "response android".split()):
        return None

    # get whether the request is a success or failure example
    success_or_fail = ""
    for keyword in OPERATION_KEYWORDS:
        if keyword in file_name.lower():
            success_or_fail = keyword
            break

    try:
        tree = ET.parse(file_name)
    except ET.ParseError as e:
        if str(e).startswith("syntax error: line 1, column 0"):
            # handle mixed files (header and XML information)
            # split them
            raw_header, raw_xml = read_mixed_file(file_name)
            folder = file_name.split("/")[0]
            if raw_xml is None:
                print("[*] File has no XML: {}".format(file_name))
                header_file_name = os.path.join(
                    folder, ".".join(["header_%s" % ("file_name"), "txt"]))
                with open(header_file_name, "w+", encoding="utf8") as header_f:
                    header_f.write(raw_header)
                header_dict[file_name] = {"header": header_file_name}
                return None

            with open(file_name, "w+", encoding="utf8") as xml_f:
                xml_f.write(raw_xml)
            new_xml_file_name = process_file_name(file_name)
            header_file_name = os.path.join(folder,
                                            ".".join(["header_" + new_xml_file_name.split(".")[0],
                                                      "txt"]))
            with open(header_file_name, "w+", encoding="utf8") as header_f:
                header_f.write(raw_header)

            header_dict[new_xml_file_name] = {"header": header_file_name}
            return new_xml_file_name

        else:
            error("[E] File: {}".format(file_name))
            error("    {}".format(e))
            ERRORS["errors"].append({"filename": file_name, "error": str(e)})
            return None

    root = tree.getroot()
    remove_namespace(root)

    payment_method = "generic"
    transaction_type = "unknown"
    try:
        payment_method = root.find(
            'payment-methods').find('payment-method').get('name')
        transaction_type = root.find('transaction-type').text
    except AttributeError as e:
        # fails for response, since there is no payment method
        # skip for now!
        #
        # error("[E] File: {}".format(file_name))
        # error("    no element found: {}".format(e))
        # print(ET.dump(root))
        return None

    return "{}_{}_{}.{}".format(payment_method, transaction_type,
                                success_or_fail, file_name.split(".")[-1])


def main():
    parser = argparse.ArgumentParser(description="""Systematically rename sample files
    (e.g. xml or json). Supported file types: {}""".format(", ".join(SUPPORTED_FILETYPES)))
    parser.add_argument("file", metavar="FILE", nargs="*",
                        help="Input file (needs to be supported)")
    parser.add_argument("-n", "--no-delete", action="store_true",
                        default=False, help="Whether or not to delete the original file")
    parser.add_argument("-d", "--dry-run", action="store_true", default=False,
                        help="Dry run - don't actually change or delete any files")
    parser.add_argument("-r", "--report", action="store_true",
                        default=False, help="Print report to file instead of stdout")
    parser.add_argument("-i", "--input-list",
                        help="List of files to rename, in case passing files via\
                            the command line does not work (too many files)")
    args = parser.parse_args()
    ###########################################################################
    if not (args.file or args.input_list):
        parser.error("Specify either FILE or --input-list")
    if args.file:
        files = args.file
    if args.input_list:
        print("[*] load files via {}".format(args.input_list))
        with open(args.input_list, "r", encoding="utf8") as f:
            files = [line.strip() for line in f]

    # exception dict is needed for splitting up files with header information
    header_dict = {}
    processed_files = [process_file_name(
        file, header_dict=header_dict) for file in files]

    report_dict = {"renames": [{"old": old, "new": new}
                               for old, new in zip(files, processed_files)
                               if new is not None]}

    if args.report:
        with open(REPORT_FILE_NAME, "w+", encoding="utf8") as report_f:
            report_f.write(json.dumps(report_dict, indent=2))
    else:
        print(json.dumps(report_dict, indent=2))

    with open(ERROR_REPORT_FILE_NAME, "w+", encoding="utf8") as error_f:
        error_f.write(json.dumps(ERRORS, indent=2))

    if args.dry_run:
        return

    # TODO: perform creation of new files
    # TODO: watch exception_dict, make sure to check it first

    if args.no_delete:
        return

    # TODO: delete original files


if __name__ == "__main__":
    main()
