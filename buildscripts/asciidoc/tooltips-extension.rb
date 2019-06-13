# coding: utf-8
#
# Tooltip Extension for asciidoctor HTML5 converter
# v0.1
#
# Adds tooltips to text elements for asciidoctor HTML5 converter
# herbert.knapp@wirecard.com
#
# Features:
#
# - Simple inline HTML tooltips for text ;)
#
# Usage:
#
# tooltip:3D[this means three dimensions]
# tooltip:what+you+did[I have no idea]

require 'asciidoctor/extensions' unless RUBY_ENGINE == 'opal'

include Asciidoctor

Extensions.register :text do
  inline_macro TooltipMacro
end

class TooltipMacro < Extensions::InlineMacroProcessor
  use_dsl

  named :tooltip
  parse_content_as :quoted

  def process parent, text, attrs
    text.gsub!(/\+/, ' ')
    (create_inline parent, :quoted, %(<span class="tooltip" title="#{attrs['text']}">#{text}</span>)).render
  end
end
