import JSZip from 'jszip';
import { analyzePptxCompatibility } from './pptxCompatibility';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

(async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  zip.file('ppt/slides/slide1.xml', `
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>
        <p:transition/>
        <p:timing><p:tnLst><p:par/></p:tnLst></p:timing>
        <p:sp><p:spPr><a:custGeom/><a:gradFill/></p:spPr></p:sp>
      </p:spTree></p:cSld>
    </p:sld>`);
  zip.file('ppt/vbaProject.bin', 'macro');
  zip.file('ppt/embeddings/oleObject1.bin', 'ole');
  zip.file('ppt/media/media1.mp4', 'video');
  zip.file('ppt/comments/comment1.xml', '<p:cmLst/>');
  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  const report = await analyzePptxCompatibility(buf);
  const codes = new Set(report.issues.map((x) => x.code));

  ok(report.issueCount >= 7, 'detecta múltiples avisos de compatibilidad');
  ok(report.hasDanger, 'marca macros como riesgo alto');
  ok(codes.has('macros'), 'detecta macros VBA');
  ok(codes.has('embedded-objects'), 'detecta OLE/ActiveX');
  ok(codes.has('audio-video'), 'detecta audio/video');
  ok(codes.has('comments'), 'detecta comentarios');
  ok(codes.has('animations'), 'detecta animaciones');
  ok(codes.has('transitions'), 'detecta transiciones');
  ok(codes.has('custom-geometry'), 'detecta geometría personalizada');
  ok(codes.has('gradients'), 'detecta gradientes');

  const total = passed + fails.length;
  if (fails.length) {
    console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n'));
    process.exit(1);
  } else console.log(`\n✅ pptx compatibility: ${passed}/${total} aserciones verdes.`);
})().catch((e) => { console.error(e); process.exit(1); });
