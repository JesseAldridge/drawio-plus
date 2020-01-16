const fs = require('fs');
const path = require('path');
const assert = require('assert');

const expand_home_dir = require('expand-home-dir');
const shell = require('shelljs');
const nuke_dir = require('rimraf');
const us = require("underscore.string");
const glob = require('glob');

const inflate_diagram = require('./inflate_diagram.js')

function main(original_dir_path) {
  console.log(`${new Date()} inflating all diagrams...`)

  const inflated_dir_path = expand_home_dir('~/inflated_diagrams');
  const mxfile_sub_path_to_mxfile = {}

  if (fs.existsSync(inflated_dir_path)) {
    // Read previously inflated files
    const json_paths = glob.sync(path.join(inflated_dir_path, '**/*.json'))
    for(let i = 0; i < json_paths.length; i++) {
      let base_path = json_paths[i].split(inflated_dir_path + '/')[1];
      try {
        mxfile_sub_path_to_mxfile[base_path] = JSON.parse(fs.readFileSync(json_paths[i], 'utf8'))
      } catch(SytaxError) {
        continue
      }
    }

    // Wipe out the old ones
    assert(inflated_dir_path.length > 10, 'inflated_dir_path too short, not wiping');
    console.log('wiping:', inflated_dir_path);
    nuke_dir.sync(inflated_dir_path);
  }
  shell.mkdir('-p', inflated_dir_path);

  console.log(`converting all .drawio files at: ${original_dir_path}`)

  inflate_all(original_dir_path, inflated_dir_path, mxfile_sub_path_to_mxfile)

  console.log(`${new Date()} done`)
}

function inflate_all(original_dir_path, inflated_dir_path, mxfile_sub_path_to_mxfile) {
  glob(path.join(original_dir_path, '**/*.drawio'), function (er, paths) {
    for(let i = 0; i < paths.length; i++) {
      const orig_file_path = paths[i];
      console.log('orig_file_path:', orig_file_path);
      let base_path = orig_file_path.split(original_dir_path)[1];
      if(!mxfile_sub_path_to_mxfile[base_path])
        mxfile_sub_path_to_mxfile[base_path] = {
          cell_id_to_cell: {}
        }
      const prev_mxfile_obj = mxfile_sub_path_to_mxfile[base_path]
      base_path = us(base_path).strLeftBack(".").value() + '.json'
      let inflated_file_path = path.join(inflated_dir_path, base_path)
      inflate_diagram.inflate_diagram(orig_file_path, inflated_file_path, prev_mxfile_obj);
    }
  });
}

main(expand_home_dir(process.argv[2]));
