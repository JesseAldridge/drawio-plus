const path = require('path');
const fs = require('fs');

const pako = require('pako');
const pd = require('pretty-data').pd;
const shell = require('shelljs');
const cheerio = require('cheerio');
const unescape_ = require('unescape');
const Papa = require('papaparse');

const stem_words = require('./stem_words.js')


function process_mxfile_elem(doc_elem, prev_mxfile_obj) {
  const new_mxfile_obj = {}
  const modified_agg = {
    min: null,
    max: null,
  }

  doc_elem('diagram').each(function(diagram_index, diagram_elem_) {
    let diagram_elem = doc_elem(diagram_elem_);
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
    diagram_elem.find('mxCell').each(function(cell_index, cell_elem_) {
      const cell_elem = doc_elem(cell_elem_)

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
      let last_modified = new Date()
      if(last_cell_obj && last_cell_obj.text == new_cell_obj.text)
        last_modified = new Date(Date.parse(last_cell_obj.last_modified))

      if(modified_agg.min)
        modified_agg.min = Math.min(last_modified, modified_agg.min)
      else
        modified_agg.min = last_modified

      if(modified_agg.max)
        modified_agg.max = Math.max(last_modified, modified_agg.max)
      else
        modified_agg.max = last_modified

      new_cell_obj.last_modified = last_modified.toISOString()
      new_cell_id_to_cell[cell_id] = new_cell_obj
    })
  });

  return {
    new_mxfile_obj: new_mxfile_obj,
    modified_agg: modified_agg,
  };
}

function color_nodes(doc_elem, new_mxfile_obj, modified_agg) {
  doc_elem('diagram').each(function(diagram_index, diagram_elem_) {
    let diagram_elem = doc_elem(diagram_elem_);
    diagram_elem.find('mxCell').each(function(cell_index, cell_el_) {
      const cell_elem = doc_elem(cell_el_)
      const style_str = cell_elem.attr('style');
      if(style_str && style_str.indexOf('image') != -1)
        return

      const style_obj = {}
      if(style_str) {
        const row = Papa.parse(style_str).data[0];
        for(let i = 0; i < row.length; i++) {
          if(row[i].length == 0)
            continue
          const split = row[i].split('=')
          style_obj[split[0]] = split[1]
        }
      }

      const cell = new_mxfile_obj[diagram_elem.attr('name')].cell_id_to_cell[cell_elem.attr("id")]
      if(!cell)
        return
      const last_modified = Date.parse(cell.last_modified)
      const delta = modified_agg.max - modified_agg.min
      let shade = 1.0
      if(delta != 0)
        shade = (last_modified - modified_agg.min) / delta / 8 + (7/8)

      let pieces = [shade, shade, shade]
      let rgb_str = '#'
      for(let i_piece = 0; i_piece < pieces.length; i_piece++) {
        let piece = Math.round(pieces[i_piece] * 255).toString(16)
        if(piece.length == 1)
          piece = '0' + piece
        rgb_str += piece
      }

      style_obj.fillColor = rgb_str

      const style_array = []
      for(let key in style_obj) {
        style_array.push([key, style_obj[key]].join('='))
      }

      cell_elem.attr('style', style_array.join(';'))
    })
  })
}

function inflate_diagram(orig_path, inflated_path, prev_mxfile_obj) {
  shell.mkdir('-p', path.dirname(inflated_path));

  fs.readFile(orig_path, 'utf8', function(err, xml) {
    const doc_elem = cheerio.load(xml, {
      xmlMode: true,
      decodeEntities: false,
      lowerCaseAttributeNames: false,
      lowerCaseTags: false
    });
    const results = process_mxfile_elem(doc_elem, prev_mxfile_obj);
    const new_mxfile_obj = results.new_mxfile_obj
    const modified_agg = results.modified_agg
    const inflated_json = JSON.stringify(new_mxfile_obj, null, 2)
    console.log('writing to:', inflated_path);
    fs.writeFile(inflated_path, inflated_json, function() {
      console.log('wrote:', inflated_path);
    });

    color_nodes(doc_elem, new_mxfile_obj, modified_agg)

    fs.writeFile(orig_path, doc_elem.html('mxfile'), function(err) {
      if(err) {
        console.log('error rewriting drawio file:', err);
      }
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
