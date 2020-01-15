const path = require('path');
const fs = require('fs');

const pako = require('pako');
const pd = require('pretty-data').pd;
const shell = require('shelljs');
const cheerio = require('cheerio');
const unescape_ = require('unescape');

const stem_words = require('./stem_words.js')


function diagram_xml_to_obj(document_html, prev_mxfile_obj) {
  const doc_elem = cheerio.load(document_html);
  let new_mxfile_obj = {}
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

    const diagram_obj = new_mxfile_obj[diagram_name] = {
      cell_id_to_cell: {}
    }

    const new_cell_id_to_cell = diagram_obj.cell_id_to_cell
    diagram_elem.find('mxCell').each(function(cell_index) {
      const cell_elem = cheerio(this)

      // skip images
      const style = cell_elem.attr('style');
      if(style && style.indexOf('image') != -1)
        return

      const cell_id = cell_elem.attr('id')
      const content = cell_elem.attr('value')

      if(!content)
        return

      const geometry_elem = cell_elem.find('mxGeometry')

      const new_cell_obj = {
        text: stem_words.stem_words(content).join(' '),
        x: geometry_elem.attr('x'),
        y: geometry_elem.attr('y'),
      }

      const last_cell_obj = ((prev_mxfile_obj[diagram_name] || {}).cell_id_to_cell || {})[cell_id]
      if(last_cell_obj) {
        new_cell_obj.last_modified = last_cell_obj.last_modified
        if(last_cell_obj.text != new_cell_obj.text)
          new_cell_obj.last_modified = new Date().toISOString()
      }
      else
        new_cell_obj.last_modified = new Date().toISOString()

      new_cell_id_to_cell[cell_id] = new_cell_obj
    })
  });

  return new_mxfile_obj;
}

function inflate_diagram(orig_path, inflated_path, prev_mxfile_obj) {
  shell.mkdir('-p', path.dirname(inflated_path));

  fs.readFile(orig_path, 'utf8', function(err, text) {
    let new_mxfile_obj = diagram_xml_to_obj(text, prev_mxfile_obj);
    console.log('writing to:', inflated_path);
    fs.writeFile(inflated_path, JSON.stringify(new_mxfile_obj, null, 2), function() {
      console.log('wrote:', inflated_path);
    });
  });
}

if(typeof(exports) != 'undefined')
  exports.inflate_diagram = inflate_diagram

if(require.main === module) {
  const prev_mxfile_obj = {
    "Tab 1": {
      "cell_id_to_cell": {
        "i4sGg8bSkyUIFC7NJkLE-1": {
          "text": "this is a test diagram",
          "x": "284",
          "y": "160",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "i4sGg8bSkyUIFC7NJkLE-2": {
          "text": "help",
          "x": "309",
          "y": "228",
          "last_modified": "2020-01-15T02:53:38.937Z"
        }
      }
    },
    "Tab 2": {
      "cell_id_to_cell": {
        "MXRy82Ifvxj1utwsVIDY-2": {
          "text": "bar",
          "x": "278",
          "y": "327",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "MXRy82Ifvxj1utwsVIDY-3": {
          "text": "baz",
          "x": "392",
          "y": "321",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "MXRy82Ifvxj1utwsVIDY-4": {
          "text": "xys",
          "x": "455",
          "y": "288",
          "last_modified": "2020-01-15T02:53:38.938Z"
        }
      }
    }
  }

  inflate_diagram('data/test.drawio', 'data/test-inflated.json', prev_mxfile_obj);
}
