const findIndex = require('binary-search');

module.exports = findSegment;

function comparator(item, distance, i, items) {
  if (distance > item.distance) { return -1; } // to big
  let prevDistance = i > 0 ? items[i - 1].distance : 0;
  if (distance <= prevDistance) { return 1; } // to small
  return 0; // found it
}

function findSegment(items, distance) {
  if (distance === 0) {
    return 1;
  }
  return findIndex(items, distance, comparator);
}
