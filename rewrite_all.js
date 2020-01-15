const fs = require('fs')
const path = require('path')

const expand_home_dir = require('expand-home-dir');
const glob = require("glob")


function main(original_dir_path) {
  glob.glob(path.join(original_dir_path, '**/*.drawio'), function (er, paths) {
    for(let i = 0; i < paths.length; i++) {
      console.log('path:', paths[i]);

      fs.readFile(paths[i], 'utf8', function(err, text) {
        text = text.replace('<mxfile', '<mxfile compressed="false"')
        fs.writeFile(paths[i], text, function() {
          console.log('wrote:', paths[i]);
        });
      });

    }
  });
}

main(expand_home_dir('~/Dropbox/diagrams'));
