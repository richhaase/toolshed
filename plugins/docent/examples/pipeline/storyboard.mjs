// Deep-dive demo: a diagram, a code dive and a real run of a tiny data pipeline.
// From plugins/docent:
//   node skills/walkthrough/scripts/walkthrough.mjs examples/pipeline/storyboard.mjs
export default {
  title: 'How Tiny Orders works',
  output: 'out/tiny-orders.mp4',
  scenes: [
    {
      type: 'title',
      kicker: 'Deep dive',
      title: 'Tiny Orders',
      subtitle: 'How raw orders become daily totals',
      say: 'Tiny Orders is a small pipeline that turns raw orders into daily totals. Here is how a row moves through it.',
    },
    {
      type: 'diagram',
      name: 'shape',
      title: 'One file in, two files out',
      nodes: [
        { id: 'raw', label: 'orders.csv', sub: 'raw rows', kind: 'store' },
        { id: 'extract', label: 'extract' },
        { id: 'validate', label: 'validate', sub: 'trust or set aside' },
        { id: 'aggregate', label: 'aggregate', sub: 'sum by day and region' },
        { id: 'totals', label: 'daily_totals.csv', kind: 'store' },
        { id: 'rejects', label: 'rejects.csv', sub: 'with a reason', kind: 'store' },
      ],
      edges: [
        ['raw', 'extract'], ['extract', 'validate'], ['validate', 'aggregate', 'good rows'],
        ['aggregate', 'totals'], ['validate', 'rejects', 'bad rows'],
      ],
      layout: [['raw'], ['extract'], ['validate'], ['aggregate', 'rejects'], ['totals']],
      steps: [
        { say: 'Everything starts with one file of raw orders, read exactly as it arrived.', show: ['raw', 'extract'] },
        { say: 'Validation is the fork in the road. Every row is either trusted or set aside.', show: ['validate', 'aggregate', 'rejects'], focus: 'validate' },
        { say: 'Trusted rows are summed by day and region, and land in the totals file.', show: 'totals', flow: ['raw', 'extract', 'validate', 'aggregate', 'totals'] },
        { say: 'Rows that fail are never dropped. They go to a rejects file with the reason attached.', flow: ['validate', 'rejects'] },
      ],
    },
    {
      type: 'code',
      name: 'validate-code',
      file: 'pipeline.py',
      steps: [
        { say: 'The fork lives in one function. It returns two lists, so nothing can fall through.', find: 'def validate', span: 3 },
        { say: 'An amount that is not a number is rejected first, before any comparison can fail.', find: 'try:', span: 5, note: 'Parse before comparing' },
        { say: 'Then come the business rules: amounts must be positive, and the region must be one we know.', find: 'if amount <= 0', span: 4 },
        { say: 'Aggregation only ever sees rows that passed, which keeps it this short.', find: 'def aggregate', span: 5 },
      ],
    },
    {
      type: 'terminal',
      name: 'run',
      title: 'tiny-orders',
      steps: [
        { say: 'Running it on seven sample orders loads four and rejects three.', run: 'python3 pipeline.py' },
        { say: 'Each rejected row keeps its data and says why it was set aside.', run: 'cat out/rejects.csv' },
      ],
    },
    {
      type: 'title',
      title: 'That is Tiny Orders',
      bullets: ['Three stages: extract, validate, aggregate', 'Bad rows are kept, with a reason', 'All of it is in pipeline.py'],
      say: 'Three stages, one fork, and no row silently lost. All of it lives in pipeline dot py.',
    },
  ],
};
