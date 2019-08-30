#!/bin/python3

import sys
import argparse
import xmltodict
import json
from collections import OrderedDict
from pprint import pprint

MAPPING = {
    'merchant-account-id/value': 'merchant-account-id',
    'payment-method/name': 'payment-method',
    'requested-amount/currency': 'requested-amount-currency',
    'requested-amount/value': 'requested-amount',
    'notification/url': 'notification-url',
}

custom_counter = 1


def format_key(key):
    """Take an old key and returns the new, generic key."""
    if key.startswith("@"):
        return key[1:]
    elif key == "#text":
        return "value"
    else:
        return key


def try_float(number):
    """
    Take a string and try to convert it to float.

    Return either the original string or the new float.
    """
    try:
        return float(number)
    except ValueError:
        return number


def walk(dict_ref, dict_working, last_key=None):
    global custom_counter
    # iterate over keys of this subtree
    for key, value in dict_ref.items():
        if isinstance(value, list):
            for element in value:
                walk(element, dict_working, key)
        elif isinstance(value, dict):
            walk(value, dict_working, last_key=key)
        else:
            k = format_key(key)
            if last_key == "custom-field":
                k = "custom_{}_{}".format(k, custom_counter)
                if "value" in k:
                    custom_counter += 1
            elif("/".join([last_key, k]) in MAPPING.keys()):
                k = MAPPING['%s/%s' % (last_key, k)]
            dict_working[k] = value


def convert_to_nvp(xml_dict):
    """
    Return a new dictionary with updated keys to better reflect the original XML.

    info_dict -- input dictionary generated from XML.

    return -- dictionary ready to be converted to NVP.
    """
    # next(iter(info_dict)) gets first key in dict
    xml_dict[next(iter(xml_dict))].pop("@xmlns", None)
    xml_dict[next(iter(xml_dict))].pop("@xmlns:xsi", None)
    new_dict = OrderedDict()
    walk(xml_dict, new_dict)
    return new_dict


def main():
    parser = argparse.ArgumentParser(
        description="Convert XML requests to NVP")
    parser.add_argument("input", nargs='?', metavar="FILE",
                        type=str, help="input XML file or read from STDIN if not specified")
    parser.add_argument("--debug", default=False, action="store_true",
                        help="print key value pairs before creating NVP string")
    parser.add_argument(
        "-o", "--output", type=str, help="output NVP file (default: print to stdout)")
    args = parser.parse_args()

    input_file = args.input
    output_file = args.output

    ###########################################################################
    # START PROCESSING
    ###########################################################################
    # use xmltodict
    xml_json_dict = {}
    if input_file:
        with open(input_file, "r+", encoding="utf8") as in_xml:
            xml_json_dict = xmltodict.parse(in_xml.read())
    else:
        xml_json_dict = xmltodict.parse("".join(sys.stdin.readlines()))

    nvp_dict = convert_to_nvp(xml_json_dict)
    if args.debug:
        for k, v in nvp_dict.items():
            print("[*] %s: %s" % (k.ljust(30), v))

    nvp = "&".join(["{}={}".format(k.replace("-", "_"), v)
                    for k, v in nvp_dict.items()])

    if output_file is None:
        print(nvp)
    else:
        with open(output_file, "w+", encoding="utf8") as out_f:
            out_f.write(nvp)


if __name__ == "__main__":
    main()
