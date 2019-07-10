#!/bin/python3

import xml.etree.ElementTree as ET
import argparse
import xmltodict
import json
from collections import OrderedDict


MOVE_TO_VALUE_KEYWORDS = "merchant-account-id".split()
CONVERT_VALUE_KEYWORDS = "amount".split()


def try_float(number):
    """
    Take a string and try to convert it to float,
    return either the original string or the new float.
    """
    try:
        return float(number)
    except ValueError:
        return number


def format_key(key):
    """Takes an old key and returns the new, generic key"""
    if key.startswith("@"):
        return key[1:]
    elif key == "#text":
        return "value"
    else:
        return key


def walk(dict_ref, dict_working, last_key=None):
    # iterate over keys of this subtree
    for key, value in dict_ref.items():
        # LIST
        if last_key == key + "s":  # handle list items
            # add list instead of dict
            if dict_working.get(last_key) is None:
                dict_working[last_key] = list()
            # for each element add the "walked over" element,
            # i.e. the processed element
            temp_dict = {}
            if isinstance(value, list):
                for element in value:
                    temp_dict = {}
                    walk(element, temp_dict, last_key)
                    dict_working[last_key].append(temp_dict)
            else:
                walk(value, temp_dict, last_key)
                dict_working[last_key].append(temp_dict)
        # DICT
        elif isinstance(value, dict):
            if dict_working.get(key) is None:
                dict_working[key] = OrderedDict()
            walk(value, dict_working[key], last_key=key)
        # certain words have a key { "value": value } ordering
        elif key in MOVE_TO_VALUE_KEYWORDS:
            dict_working[key] = OrderedDict({"value": value})
        # handle the rest
        else:
            new_key = format_key(key)
            # use string as datatype unless parent element has a keyword like 'amount' in its name
            # and can be converted to float
            dict_working[new_key] = value
            if last_key and \
                    any(w in last_key for w in CONVERT_VALUE_KEYWORDS) and \
                    new_key == "value":
                dict_working[new_key] = try_float(value)


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
