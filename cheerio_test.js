var fs = require('fs');

var cheerio = require('cheerio');


const xml = fs.readFileSync('data/test.drawio', 'utf8')

const doc_elem = cheerio.load(xml, {
  xmlMode: true,
  decodeEntities: false,
  lowerCaseAttributeNames: false,
  lowerCaseTags: false
});

doc_elem('diagram').each(function(diagram_index, diagram_el_) {
  const diagram_el = doc_elem(diagram_el_)
  diagram_el.find('mxCell').each(function(_, cell_el_) {
    console.log(doc_elem(cell_el_).attr('value'))
  })
})

// doc_elem('mxCell').attr('style', 'fillColor=#ff0000')

// fs.writeFileSync('data/test.drawio.drawio', doc_elem.html())
