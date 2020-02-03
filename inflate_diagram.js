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
    let diagram_id = diagram_elem.attr('id')
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

    const diagram_obj = new_mxfile_obj[diagram_id] = {
      cell_id_to_cell: {},
      name: diagram_name,
    }

    function process_cell(cell_index, cell_elem_) {
      const cell_elem = doc_elem(cell_elem_)

      // skip images
      const style = cell_elem.attr('style');
      if(style && style.indexOf('image') != -1)
        return

      const cell_id = cell_elem.attr('id')
      let content = cell_elem.attr('value')

      if(!content)
        return

      process_cell_value(content, cell_id, cell_elem)
    }

    function process_user_object(cell_index, user_object_) {
      const user_object = doc_elem(user_object_)
      const obj_id = user_object.attr('id')
      const content = user_object.attr('label')
      const cell_elem = user_object.find('mxCell')
      debugger
      process_cell_value(content, obj_id, cell_elem)
    }

    function process_cell_value(content, cell_id, cell_elem) {
      content = unescape_(content);

      const geometry_elem = cell_elem.find('mxGeometry')

      const new_cell_obj = {
        original_text: content,
        stemmed_text: stem_words.stem_words(content).join(' '),
        x: geometry_elem.attr('x'),
        y: geometry_elem.attr('y'),
      }

      const last_cell_obj = ((prev_mxfile_obj[diagram_id] || {}).cell_id_to_cell || {})[cell_id]
      let last_modified = new Date()
      // If the cell is the same as it was, set last_modified to previous value
      if(last_cell_obj && last_cell_obj.original_text == new_cell_obj.original_text)
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
    }

    const new_cell_id_to_cell = diagram_obj.cell_id_to_cell
    diagram_elem.find('root > mxCell').each(process_cell)
    diagram_elem.find('UserObject').each(process_user_object)
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

      // Ignore nodes that are not a shade of grey
      if(style_obj.fillColor) {
        const hex_str = style_obj.fillColor.slice(1)
        if(!((hex_str[0] == hex_str[2] == hex_str[4]) &&
             (hex_str[1] == hex_str[3] == hex_str[5])))
          return
      }

      const cell = new_mxfile_obj[diagram_elem.attr('id')].cell_id_to_cell[cell_elem.attr("id")]
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
  const xml = fs.readFileSync(orig_path, 'utf8');

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
  fs.writeFileSync(inflated_path, inflated_json);
  doc_elem('mxfile').attr('compressed', false)
  color_nodes(doc_elem, new_mxfile_obj, modified_agg)

  fs.writeFileSync(orig_path, doc_elem.html('mxfile'));
}

if(typeof(exports) != 'undefined')
  exports.inflate_diagram = inflate_diagram

if(require.main === module) {
  const prev_mxfile_obj = {
    "1dMstaCY08wY50I3MFBW": {
      "cell_id_to_cell": {
        "i4sGg8bSkyUIFC7NJkLE-1": {
          "original_text": "thy is a test diagram swimming",
          "stemmed_text": "thy is a test diagram swim",
          "x": "284",
          "y": "160",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "i4sGg8bSkyUIFC7NJkLE-2": {
          "original_text": "help",
          "stemmed_text": "help",
          "x": "309",
          "y": "228",
          "last_modified": "2020-01-15T02:53:38.937Z"
        }
      },
      "name": "Tab 1"
    },
    "GHfeHe2o456X1Uvl4aY1": {
      "cell_id_to_cell": {
        "MXRy82Ifvxj1utwsVIDY-2": {
          "original_text": "bar",
          "stemmed_text": "bar",
          "x": "278",
          "y": "327",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "MXRy82Ifvxj1utwsVIDY-3": {
          "original_text": "baz",
          "stemmed_text": "baz",
          "x": "392",
          "y": "321",
          "last_modified": "2020-01-15T02:53:38.937Z"
        },
        "MXRy82Ifvxj1utwsVIDY-4": {
          "original_text": "test change",  // I updated this node
          "stemmed_text": "test chang",
          "x": "455",
          "y": "288",
          "last_modified": "2020-01-15T02:53:38.938Z"
        }
      },
      "name": "Tab 2"
    }
  }

  inflate_diagram('data/test.drawio', 'data/test-inflated.json', prev_mxfile_obj);

  const text = fs.readFileSync('data/test-inflated.json', 'utf8')
  console.log([...text.matchAll('2020-01-15')].length)
  console.log('all good:', [...text.matchAll('2020-01-15')].length == 4)
}
