#!/usr/local/bin/node
const glob = require('glob');
const expand_home_dir = require('expand-home-dir');

// const stemmer = require('./PorterStemmer1980.js')
const natural = require('natural');

const search_diagram = require('./search_diagram.js')


const inflated_dir_path = expand_home_dir('~/inflated_diagrams/');
const inflated_paths = glob.sync(inflated_dir_path + '**/*.json');

const query_term_strings = process.argv.slice(2);
const query_term_objs = []
for(let i = 0; i < query_term_strings.length; i++) {
  const lower_term = query_term_strings[i].toLocaleLowerCase()
  query_term_objs[i] = {
    original: lower_term,
    stemmed: natural.LancasterStemmer.stem(lower_term),
  }
}

console.log('query terms:', query_term_objs)

// Search content
const matches = [];
const term_to_document_frequency = {};
inflated_paths.forEach(function(path_) {
  console.log('searching:', path_)
  const match = search_diagram.search_diagram(
    inflated_dir_path,
    path_,
    query_term_objs,
    term_to_document_frequency
  )
  if(match)
    matches.push(match)
});

function score(match) {
  let document_score = 0;
  for(let term in match.term_to_score)
    document_score += match.term_to_score[term] / (term_to_document_frequency[term] || 1);
  return document_score;
}

matches.sort(function(a,b) {
  return score(a) - score(b)
});

matches.forEach(function(match) {
  const cell_match_json = JSON.stringify(match.term_to_tab_to_matching_cells, null, 2)
  console.log('match:', match.path, score(match).toFixed(2), cell_match_json);
});
