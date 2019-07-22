#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Fork of 'embed-font-to-svg.py, adapted for CSS only
# https://gist.github.com/alexsavio/dace6ca43ed73c04c641
#

import os
import os.path as op
import base64
import argparse
import logging
from lxml import etree


FONT_TYPES = {'ttf': 'truetype',
              'otf': 'opentype'}


def create_argparser():
    parser = argparse.ArgumentParser(description="""Embed base64 font to CSS file. Typical call:
    python scripts/fonts/embed-font-to-css.py --name ff-din-web -f fonts/DINWebPro.ttf
    -b fonts/DINWebPro-Bold.ttf -o css/wirecard-font-base64.css""")
    parser.add_argument('-f', '--font', dest='font', help='Font file')
    parser.add_argument('-b', '--bold', dest='bold', help='Font file for bold')
    parser.add_argument('-i', '--italic', dest='italic', help='Font file for italic')
    parser.add_argument("--name", dest="name", help='Overwrite name for font')
    parser.add_argument('-o', '--output', action='store', dest='out_path', default='',
                        help='The resulting CSS file path. Overwritten if exist.')
    return parser


def get_base64_encoding(bin_filepath):
    """Return the base64 encoding of the given binary file"""

    if not op.exists(bin_filepath):
        msg = 'Could not find file {}.'.format(bin_filepath)
        log.error(msg)
        raise IOError(msg)

    return str(base64.b64encode(open(bin_filepath, 'rb').read()))


def remove_ext(filepath):
    """Return the basename of filepath without extension."""
    return op.basename(filepath).split('.')[0]


def get_ext(filepath):
    """Return file extension"""
    return op.basename(filepath).split('.')[-1]


class FontFace(object):
    """CSS font-face object"""

    def __init__(self, filepath, fonttype=None, name=None, weight=None, style=None):
        self.filepath = filepath
        self.ftype = fonttype
        self.given_name = name
        self.weight = weight
        self.style = style

    @classmethod
    def from_file(cls, filepath):
        return cls(filepath)

    @property
    def name(self):
        if self.given_name is None:
            return remove_ext(self.filepath)
        else:
            return self.given_name

    @property
    def base64(self):
        return get_base64_encoding(self.filepath)

    @property
    def fonttype(self):
        if self.ftype is None:
            return FONT_TYPES[get_ext(self.filepath)]
        else:
            return self.ftype

    @property
    def ext(self):
        return get_ext(self.filepath)

    @property
    def css_text(self):
        css_text  = u"@font-face{\n"
        css_text += u"font-family: " + self.name + ";\n"
        if self.weight is not None:
            css_text += u"font-weight: " + self.weight + ";\n"
        if self.style is not None:
            css_text += u"font-style: " + self.style + ";\n"
        css_text += u"src: url(data:font/" + self.ext + ";"
        css_text += u"base64," + self.base64 + ") "
        css_text += u"format('" + self.fonttype + "');\n}\n"
        return css_text


class FontFaceGroup(object):
    """Group of FontFaces"""

    def __init__(self):
        self.fontfaces = []

    @property
    def css_text(self):
        css_text = ""
        for ff in self.fontfaces:
            css_text += ff.css_text
        return css_text

    def append(self, font_face):
        self.fontfaces.append(font_face)
    
    def get(self, index):
        return self.fontfaces[index]


if __name__ == '__main__':

    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger(__file__)

    parser = create_argparser()
    try:
        args = parser.parse_args()
    except argparse.ArgumentError as exc:
        log.exception('Error parsing arguments.')
        parser.error(str(exc.message))
        exit(-1)

    font = args.font
    bold = args.bold
    italic = args.italic
    name = args.name
    out_path = args.out_path

    #check where to write the stuff
    stdout = False
    raw_write = False

    if not out_path:
        raw_write = True
        stdout = True

    #check if user gave any font
    if not font:
        log.error('No fonts given.')
        exit(-1)

    #build the stuff to write
    fontfaces = FontFaceGroup()
    if name is not None:
        fontfaces.append(FontFace(font, name=name))
    else:
        fontfaces.append(FontFace(font))
    font_name = fontfaces.get(0).name
    if bold:
        fontfaces.append(FontFace(bold, name=font_name, weight="bold"))
    if italic:
        fontfaces.append(FontFace(italic, name=font_name, style="italic"))

    #write the stuff
    if stdout:
        print(fontfaces.css_text)
        exit(0)
    else:
        with open(out_path, 'w+', encoding="utf-8") as f:
            f.write(fontfaces.css_text)
        exit(0)
