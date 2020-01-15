const path = require('path');
const fs = require('fs');

const pako = require('pako');
const pd = require('pretty-data').pd;
const shell = require('shelljs');
const cheerio = require('cheerio');
const unescape_ = require('unescape');

const stem_words = require('./stem_words.js')


function diagram_xml_to_obj(document_html) {
  const doc_elem = cheerio.load(document_html);
  let name_to_diagram = {}
  doc_elem('diagram').each(function(diagram_index) {
    let diagram_elem = cheerio(this);
    // let diagram_text = diagram_elem.text();
    let diagram_name = diagram_elem.attr('name')

    // try {
    //   diagram_text = decodeURIComponent(diagram_text);
    // }
    // catch(err) {
    //   console.log('error in decodeURIComponent');
    //   return;
    // }

    // diagram_text = unescape_(diagram_text);
    // diagram_text = pd.xml(diagram_text);

    const diagram_obj = {
      cells: []
    }
    name_to_diagram[diagram_name] = diagram_obj

    const cells = diagram_obj.cells
    diagram_elem.find('mxCell').each(function(cell_index) {
      const cell_elem = cheerio(this)

      // skip images
      const style = cell_elem.attr('style');
      if(style && style.indexOf('image') != -1)
        return

      const content = cell_elem.attr('value')

      if(!content)
        return

      const geometry_elem = cell_elem.find('mxGeometry')

      cells.push({
        text: stem_words.stem_words(content).join(' '),
        x: geometry_elem.attr('x'),
        y: geometry_elem.attr('y'),
      })
    })
  });

  return name_to_diagram;
}

function inflate_diagram(orig_path, inflated_path) {
  shell.mkdir('-p', path.dirname(inflated_path));

  fs.readFile(orig_path, 'utf8', function(err, text) {
    let name_to_diagram = diagram_xml_to_obj(text);
    console.log('writing to:', inflated_path);
    fs.writeFile(inflated_path, JSON.stringify(name_to_diagram, null, 2), function() {
      console.log('wrote:', inflated_path);
    });
  });
}

if(typeof(exports) != 'undefined')
  exports.inflate_diagram = inflate_diagram

if(require.main === module) {
  inflate_diagram('data/test.drawio', 'data/test-inflated.json');
}
