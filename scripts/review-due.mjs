import { overdue, validateData } from './validate.mjs';

const { records, date } = validateData({ quiet: true });
const due = records.filter(record => record.publication_status === 'listed')
  .flatMap(record => overdue(record, date).map(item => record.id + ' ' + item));
console.log('Review as of ' + date);
console.log(due.length ? due.join('\n') : 'No published web reviews or direct confirmations have reached their age thresholds.');
