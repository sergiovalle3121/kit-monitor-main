import { tiptapJsonToHtmlDocument } from './html';

const html = tiptapJsonToHtmlDocument({ type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'SOP' }] },
  { type: 'paragraph', content: [
    { type: 'text', text: 'WO ' },
    { type: 'axosRef', attrs: { entity: 'work_order', refId: 'WO-1', label: 'WO-1' } },
    { type: 'text', text: ' Rev ' },
    { type: 'docField', attrs: { key: 'revision', label: 'Rev', value: 'A' } },
  ] },
]}, 'Test');

if (!html.includes('data-entity="work_order"')) throw new Error('AXOS ref not exported');
if (!html.includes('data-key="revision"')) throw new Error('doc field not exported');
if (!html.includes('<h1>SOP</h1>')) throw new Error('heading not exported');
console.log('✅ html export smoke');
