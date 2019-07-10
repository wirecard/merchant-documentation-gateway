#!/bin/python3

import xml.etree.ElementTree as ET
import argparse
import xmltodict
import json
from collections import OrderedDict


def walk(dict_ref, dict_working):
    # iterate over keys of this subtree
    for key in iter(dict_ref):
        if isinstance(dict_ref[key], dict):
            if dict_working.get(key) is None:
                dict_working[key] = OrderedDict()
            walk(dict_ref[key], dict_working[key])
        elif key.startswith("@"):
            dict_working[key[1:]] = dict_ref[key]
        elif key == "#text":
            dict_working["value"] = dict_ref[key]
        else:
            dict_working[key] = dict_ref[key]


def post_process_json(info_dict):
    """
    Return a new dictionary with updated keys to better reflect the original XML.

    info_dict -- input dictionary generated from XML.

    return -- dictionary ready to be converted to JSON.
    """
    # next(iter(info_dict)) gets first key in dict
    info_dict[next(iter(info_dict))].pop("@xmlns", None)
    new_dict = OrderedDict()
    walk(info_dict, new_dict)
    return new_dict


def main():
    parser = argparse.ArgumentParser(
        description="Convert XML requests to JSON")
    parser.add_argument("input", metavar="FILE",
                        type=str, help="Input XML file")
    parser.add_argument(
        "-o", "--output", type=str, help="Output JSON file (default: print to stdout")
    args = parser.parse_args()

    input_file = args.input
    output_file = args.output

    ###########################################################################
    # START PROCESSING
    ###########################################################################

    # use ET
    # xml_tree = ET.parse(input_file)

    # use xml2json
    xml_json_dict = {}
    with open(input_file, "r+", encoding="utf8") as in_xml:
        xml_json_dict = xmltodict.parse(in_xml.read())

    xml_json_dict = post_process_json(xml_json_dict)

    json_text = json.dumps(xml_json_dict, indent=2)

    if output_file is None:
        print(json_text)
    else:
        with open(output_file, "w+", encoding="utf8") as out_f:
            out_f.write(json_text)


if __name__ == "__main__":
    main()
