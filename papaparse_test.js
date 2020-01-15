const fs = require('fs');
const path = require('path');

const Papa = require('papaparse');

const style_str = (
  'endArrow=classic;html=1;shadow=0;strokeColor=#000000;fillColor=#7D7D7D;fontSize=12;' +
  'fontColor=#000000;'
)
const style_obj = {}
const row = Papa.parse(style_str).data[0];
for(let i = 0; i < row.length; i++) {
  if(row[i].length == 0)
    continue
  const split = row[i].split('=')
  style_obj[split[0]] = split[1]
}

style_obj.fillColor = '#ff0000'

const style_array = []
for(let key in style_obj) {
  style_array.push([key, style_obj[key]].join('='))
}

console.log(style_array.join(';'))
