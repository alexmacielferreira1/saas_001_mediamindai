import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create:vi.fn(), list:vi.fn(), upload:vi.fn() }));
vi.mock('@/api/base44Client',()=>({base44:{entities:{CreativeDocument:{create:mocks.create,list:mocks.list}}}}));
vi.mock('@/api/media',()=>({uploadMediaAsset:mocks.upload,resolveMediaUrl:(url)=>url}));
import { saveToolDocument, listToolDocuments, persistToolMedia, parseProjectFile, parseSceneLines, safeSourceUrl, buildSrt } from '../mediamind/lib/creativeToolDocuments';
beforeEach(()=>{vi.clearAllMocks();});
describe('tool documents and reference helpers',()=>{
 it('uploads repeated media once and retains project association and previous version',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob(['photo'],{type:'image/png'})})));mocks.upload.mockResolvedValue({stream_url:'/api/media/photo'});mocks.create.mockResolvedValue({id:'doc2'});
  await saveToolDocument({tool:'frames',projectId:'p1',title:'Moldura',previousId:'doc1',value:{one:'blob:photo',scenes:[{media:'blob:photo'}]}});expect(mocks.upload).toHaveBeenCalledOnce();expect(mocks.upload.mock.calls[0][1]).toMatchObject({project_id:'p1'});expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({project_id:'p1',previous_version_id:'doc1',content:{one:'/api/media/photo',scenes:[{media:'/api/media/photo'}]}}));vi.unstubAllGlobals();
 });
 it('never creates a document after a source upload fails',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));await expect(saveToolDocument({tool:'frames',title:'A',value:{media:'blob:expired'}})).rejects.toThrow('expirou');expect(mocks.create).not.toHaveBeenCalled();vi.unstubAllGlobals();});
 it('only reopens versions of the selected tool and project',async()=>{mocks.list.mockResolvedValue([{id:'1',tool_type:'ai-tool',tool_id:'frames',project_id:'p1'},{id:'2',tool_type:'ai-tool',tool_id:'frames',project_id:'p2'},{id:'3',tool_type:'ai-tool',tool_id:'voice-studio',project_id:'p1'}]);expect(await listToolDocuments('frames','p1')).toHaveLength(1);});
 it('rejects imported files from a different tool',()=>{expect(()=>parseProjectFile(JSON.stringify({schema:'mediamind-creative/v1',tool:'frames',content:{}}),'voice-studio')).toThrow('esta ferramenta');});
 it('does not turn unsafe references into clickable links',()=>{expect(safeSourceUrl('javascript:alert(1)')).toBe('');expect(safeSourceUrl('https://example.com')).toBe('https://example.com/');});
 it('exports reviewed subtitles with millisecond timecodes',()=>{expect(buildSrt([{start:1.25,end:4.7,text:'Original',translation:'Traduzido'}])).toContain('00:00:01,250 --> 00:00:04,700\nTraduzido');});
 it('keeps a custom scene tag and strips it from the narration',()=>{expect(parseSceneLines('[tempo] Uma fala\nOutra fala')).toEqual([{tag:'tempo',text:'Uma fala'},{tag:'ideia',text:'Outra fala'}]);});
 it('preserves already persistent URLs without uploading them again',async()=>{expect(await persistToolMedia({url:'/api/media/a'},'p')).toEqual({url:'/api/media/a'});expect(mocks.upload).not.toHaveBeenCalled();});
});
