const fs = require('fs');
const path = require('path');
const assert = require('assert');

const expand_home_dir = require('expand-home-dir');
const shell = require('shelljs');
const nuke_dir = require('rimraf');
const us = require("underscore.string");
const glob = require('glob');

const inflate_diagram = require('./inflate_diagram.js')

function remove_dir_path(dir_path, file_path) {
  if(dir_path[dir_path.length - 1] != '/')
    dir_path += '/'
  return file_path.split(dir_path)[1]
}

function read_old_and_inflate(original_dir_path) {
  console.log(`${new Date()} inflating all diagrams...`)

  const inflated_dir_path = expand_home_dir('~/inflated_diagrams');
  const path_name_to_mxfile = {}

  if (fs.existsSync(inflated_dir_path)) {
    // Read previously inflated files
    const json_paths = glob.sync(path.join(inflated_dir_path, '**/*.json'))
    for(let i = 0; i < json_paths.length; i++) {
      const base_path = remove_dir_path(inflated_dir_path, json_paths[i])
      const base_name = us(base_path).strLeftBack(".").value();
      const text = fs.readFileSync(json_paths[i], 'utf8')
      try {
        path_name_to_mxfile[base_name] = JSON.parse(text)
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

  inflate_all(original_dir_path, inflated_dir_path, path_name_to_mxfile)

  console.log(`${new Date()} done`)
}

function inflate_all(original_dir_path, inflated_dir_path, path_name_to_mxfile) {
  const paths = glob.sync(path.join(original_dir_path, '**/*.drawio'))
  for(let i = 0; i < paths.length; i++) {
    const orig_file_path = paths[i];
    console.log('orig_file_path:', orig_file_path);
    const base_path = remove_dir_path(original_dir_path, orig_file_path)
    let base_name = us(base_path).strLeftBack('.').value();
    if(!path_name_to_mxfile[base_name])
      path_name_to_mxfile[base_name] = {
        cell_id_to_cell: {}
      }
    const prev_mxfile_obj = path_name_to_mxfile[base_name]
    let inflated_file_path = path.join(inflated_dir_path, base_name + '.json')
    inflate_diagram.inflate_diagram(orig_file_path, inflated_file_path, prev_mxfile_obj);
  }
}

function main() {
  console.log('process.argv:', process.argv)
  const diagrams_path = expand_home_dir(process.argv[2])
  read_old_and_inflate(diagrams_path)
  console.log('inflated, sleeping for 2 hours...')
  setTimeout(main, 1000 * 60 * 60 * 2)
}

if(require.main === module) {
  main();
}
