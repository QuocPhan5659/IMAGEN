import { GoogleGenAI } from "@google/genai";

// --- Text Overlay State (Grid) ---
interface OverlaySlot {
    id: string;
    file: File | null;
    imgSrc: string | null;
    text: string;
    isDarkText: boolean;
    resultSrc: string | null;
    isTranslating: boolean;
    originalName: string | null;
}

let overlaySlots: OverlaySlot[] = [];
let globalFont = 'Inter';
let globalSignature = '';
let globalLogoSrc: string | null = null;
let globalSigBgColor = '#FFD700'; // Default Gold

// --- Application State ---
type Lang = 'en' | 'vi';
let currentLang: Lang = 'en';
let activeTab: 'analysis' | 'multiview' | 'notes' | 'textOverlay' = 'analysis';
let currentSketchFile: File | null = null;
let currentFiles: File[] = [];

interface AnalysisResult {
    style?: { en: string; vi: string };
    materials?: { en: string; vi: string };
    lighting?: { en: string; vi: string };
    context?: { en: string; vi: string };
    composition?: { en: string; vi: string };
    generationPrompt?: { en: string; vi: string };
    sketchPrompt?: { en: string; vi: string };
    multiViewPrompts?: { en: string; vi: string };
    [key: string]: any;
}
let lastAnalysisData: AnalysisResult | null = null;

interface CustomAngleEntry {
    en: { title: string; content: string; composition: string; lighting: string };
    vi: { title: string; content: string; composition: string; lighting: string };
}
let customAnglesHistory: CustomAngleEntry[] = [];

interface NoteEntry {
    file: File;
    vi: string;
    en: string;
}
let notesHistory: NoteEntry[] = [];

interface Arrow {
    nx1: number; ny1: number; nx2: number; ny2: number;
}
const fileArrowMap = new Map<File, Arrow[]>();

// Canvas/Drawing State
let currentEditingFile: File | null = null;
let arrowHistory: Arrow[] = [];
let isDrawing = false;
let startX = 0;
let startY = 0;

// Zoom State
let zoomScale = 1;
let zoomTranslateX = 0;
let zoomTranslateY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// --- Helper Functions ---
function getEl<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function setHidden(el: HTMLElement | null, hidden: boolean) {
    if (!el) return;
    if (hidden) el.classList.add('hidden');
    else el.classList.remove('hidden');
}

function addClass(el: HTMLElement | null, ...classes: string[]) {
    if (!el) return;
    el.classList.add(...classes);
}

function removeClass(el: HTMLElement | null, ...classes: string[]) {
    if (!el) return;
    el.classList.remove(...classes);
}

function setText(el: HTMLElement | null, text: string) {
    if (el) el.textContent = text;
}

function hexToRgba(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Window Interface for AI Studio ---
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }
    interface Window {
        aistudio?: AIStudio;
    }
}

// --- Translations ---
const translations = {
    en: {
        appTitle: "Architectural AI Analyst",
        appSubtitle: "Deep analysis powered by Gemini Vision",
        uploadTitle: "Upload Images",
        uploadDrag: "Drag & Drop, Click or Paste (Ctrl+V)",
        uploadSketch: "Upload Sketch (Optional)",
        btnAnalyze: "Analyze Images",
        btnDownloadAll: "Download All",
        btnLoadPngInfo: "PNG Info",
        btnMultiView: "Generate Multi-View",
        lblAngleCount: "Angle Count",
        lblCustomAngle: "Custom Angle Request",
        customAnglePlaceholder: "e.g., 'Low angle shot looking up at the entrance...'",
        btnCustomAngle: "Generate Custom Angle",
        loaderTitle: "ANALYZING...",
        loaderSubtitle: "Gemini is analyzing architectural details...",
        tabAnalysis: "Analysis",
        tabMultiView: "Multi-View",
        tabNotes: "Notes",
        tabTextOverlay: "Text Overlay",
        lblObjAnalysis: "Detailed Object Analysis",
        lblObjDesc: "Analyze uploaded images to establish a unified reference (DNA) for consistent angle generation.",
        btnObjAnalysis: "Analyze Object DNA",
        btnAnalyzeNotes: "Extract & Translate Notes",
        titles: {
            style: "Architectural Style",
            materials: "Materials & Textures",
            lighting: "Lighting & Atmosphere",
            context: "Context & Environment",
            composition: "Composition & Camera",
            prompt: "Generation Prompt",
            sketchPrompt: "Sketch Prompt",
            generationPrompt: "Generation Prompt",
            multiViewPrompts: "Multi-View Prompts"
        }
    },
    vi: {
        appTitle: "Trợ Lý Kiến Trúc AI",
        appSubtitle: "Phân tích sâu hỗ trợ bởi Gemini Vision",
        uploadTitle: "Tải Ảnh Lên",
        uploadDrag: "Kéo thả, Nhấn hoặc Dán (Ctrl+V)",
        uploadSketch: "Tải Phác Thảo (Tùy chọn)",
        btnAnalyze: "Phân Tích Ảnh",
        btnDownloadAll: "Tải Tất Cả",
        btnLoadPngInfo: "Đọc PNG Info",
        btnMultiView: "Tạo Đa Góc Nhìn",
        lblAngleCount: "Số lượng góc",
        lblCustomAngle: "Yêu cầu góc tùy chỉnh",
        customAnglePlaceholder: "VD: 'Góc thấp nhìn lên lối vào...'",
        btnCustomAngle: "Tạo Góc Tùy Chỉnh",
        loaderTitle: "ĐANG PHÂN TÍCH...",
        loaderSubtitle: "Gemini đang xử lý chi tiết kiến trúc...",
        tabAnalysis: "Phân Tích",
        tabMultiView: "Đa Góc Nhìn",
        tabNotes: "Ghi Chú",
        tabTextOverlay: "Chèn Chữ",
        lblObjAnalysis: "Phân Tích Chi Tiết Đối Tượng",
        lblObjDesc: "Phân tích các ảnh đã tải để thiết lập tham chiếu chung (DNA) cho việc tạo góc nhìn đồng nhất.",
        btnObjAnalysis: "Phân Tích Cốt Lõi",
        btnAnalyzeNotes: "Trích Xuất & Dịch Ghi Chú",
        titles: {
            style: "Phong Cách Kiến Trúc",
            materials: "Vật Liệu & Kết Cấu",
            lighting: "Ánh Sáng & Không Khí",
            context: "Bối Cảnh & Môi Trường",
            composition: "Bố Cục & Camera",
            prompt: "Prompt Tạo Ảnh",
            sketchPrompt: "Prompt Phác Thảo",
            generationPrompt: "Prompt Tạo Ảnh",
            multiViewPrompts: "Prompt Đa Góc Nhìn"
        }
    }
};

// --- DOM Elements ---
const tabAnalysis = getEl<HTMLButtonElement>('tab-analysis');
const tabNotes = getEl<HTMLButtonElement>('tab-notes');
const tabMultiView = getEl<HTMLButtonElement>('tab-multiview');
const tabTextOverlay = getEl<HTMLButtonElement>('tab-text-overlay');

const panelAnalysis = getEl<HTMLDivElement>('panel-analysis');
const panelNotes = getEl<HTMLDivElement>('panel-notes');
const panelMultiView = getEl<HTMLDivElement>('panel-multiview');
const panelUploadAnalysis = getEl<HTMLDivElement>('panel-upload-analysis');
const panelTextOverlaySettings = getEl<HTMLDivElement>('panel-text-overlay-settings');

// Global Action Bar Elements
const globalActionsBar = getEl<HTMLDivElement>('global-actions-bar');
const btnExpandAll = getEl<HTMLButtonElement>('btn-expand-all');
const btnCollapseAll = getEl<HTMLButtonElement>('btn-collapse-all');
const btnClearResults = getEl<HTMLButtonElement>('btn-clear-results');

// Text Overlay Global
const btnResetOverlay = getEl<HTMLButtonElement>('btn-reset-overlay');
const btnAddSlot = getEl<HTMLButtonElement>('btn-add-slot');
const btnEmbedAll = getEl<HTMLButtonElement>('btn-embed-all');
const btnDownloadAllEmbeds = getEl<HTMLButtonElement>('btn-download-all-embeds');
const globalFontSelect = getEl<HTMLSelectElement>('global-font-select');
const globalSignatureInput = getEl<HTMLInputElement>('global-signature');
const signatureDropIndicator = getEl<HTMLDivElement>('signature-drop-indicator');
const signatureFileInput = getEl<HTMLInputElement>('signature-file-input');
const btnUploadSig = getEl<HTMLButtonElement>('btn-upload-sig');
const overlayGrid = getEl<HTMLDivElement>('overlay-grid');

// Logo Overlay Global
const logoDropZone = getEl<HTMLDivElement>('logo-drop-zone');
const logoFileInput = getEl<HTMLInputElement>('logo-file-input');
const logoPreview = getEl<HTMLImageElement>('logo-preview');
const logoEmpty = getEl<HTMLDivElement>('logo-empty');
const btnClearLogo = getEl<HTMLButtonElement>('btn-clear-logo');

const dropZone = getEl<HTMLDivElement>('drop-zone');
const emptyState = getEl<HTMLDivElement>('empty-state'); 
const fileInput = getEl<HTMLInputElement>('file-input');
const clearBtn = getEl<HTMLButtonElement>('clear-btn');
const previewContainer = getEl<HTMLDivElement>('preview-container');

// Text Elements
const appTitle = getEl('app-title');
const appSubtitle = getEl('app-subtitle');
const lblUpload = getEl('lbl-upload');
const lblDrag = getEl('lbl-drag');
const lblUploadSketch = getEl('lbl-upload-sketch');
const btnAnalyzeText = getEl('btn-analyze-text');
const btnDownloadAllText = getEl('btn-download-all-text');
const btnLoadPngInfoText = getEl('btn-load-png-info-text');
const loaderTitle = getEl('loader-title');
const loaderSubtitle = getEl('loader-subtitle');

// Results & Loaders
const statusMsg = getEl<HTMLParagraphElement>('status-msg');
const resultsContainer = getEl<HTMLDivElement>('results-container');
const loader = getEl<HTMLDivElement>('loader');
const analysisCardsWrapper = getEl<HTMLDivElement>('analysis-cards-wrapper');
const notesResults = getEl<HTMLDivElement>('notes-results');
const multiviewResults = getEl<HTMLDivElement>('multiview-results');

const analyzeBtn = getEl<HTMLButtonElement>('analyze-btn');
const analyzeNotesBtn = getEl<HTMLButtonElement>('analyze-notes-btn');
const btnAnalyzeNotesText = getEl('btn-analyze-notes-text');
const downloadAllBtn = getEl<HTMLButtonElement>('download-all-btn');
const btnLoadPngInfo = getEl<HTMLButtonElement>('btn-load-png-info');

// Single Analysis Cards Content
const resStyle = getEl<HTMLParagraphElement>('res-style');
const resMaterial = getEl<HTMLParagraphElement>('res-material');
const resLighting = getEl<HTMLParagraphElement>('res-lighting');
const resContext = getEl<HTMLParagraphElement>('res-context');
const resComposition = getEl<HTMLParagraphElement>('res-composition');
const resPrompt = getEl<HTMLParagraphElement>('res-prompt');
const resSketchPrompt = getEl<HTMLParagraphElement>('res-sketch-prompt');

// Titles
const titleStyle = getEl('title-style');
const titleMaterial = getEl('title-material');
const titleLighting = getEl('title-lighting');
const titleContext = getEl('title-context');
const titleComposition = getEl('title-composition');
const titlePrompt = getEl('title-prompt');
const titleSketchPrompt = getEl('title-sketch-prompt');

// Buttons for Single Analysis
const btnRunPrompt = getEl<HTMLButtonElement>('btn-run-prompt');
const btnRunSketchPrompt = getEl<HTMLButtonElement>('btn-run-sketch-prompt');
const btnRunStyle = getEl<HTMLButtonElement>('btn-run-style');
const btnRunMaterial = getEl<HTMLButtonElement>('btn-run-material');
const btnRunLighting = getEl<HTMLButtonElement>('btn-run-lighting');
const btnRunContext = getEl<HTMLButtonElement>('btn-run-context');
const btnRunComposition = getEl<HTMLButtonElement>('btn-run-composition');
const btnPngInfoPrompt = getEl<HTMLButtonElement>('btn-png-info-prompt');
const btnSendBanana = getEl<HTMLButtonElement>('btn-send-banana');
const btnPasteBanana = getEl<HTMLButtonElement>('btn-paste-banana');


// Sketch Elements
const sketchContainer = getEl<HTMLDivElement>('sketch-container');
const sketchDropZone = getEl<HTMLDivElement>('sketch-drop-zone');
const sketchInput = getEl<HTMLInputElement>('sketch-input');
const sketchEmptyState = getEl<HTMLDivElement>('sketch-empty-state');
const sketchPreviewImg = getEl<HTMLImageElement>('sketch-preview-img');
const sketchClearBtn = getEl<HTMLButtonElement>('sketch-clear-btn');
const sketchPromptCard = getEl<HTMLDivElement>('card-sketch-prompt');

// MultiView Elements
const multiviewContextContainer = getEl<HTMLDivElement>('multiview-context-container');
const lblObjAnalysis = getEl('lbl-obj-analysis');
const lblObjDesc = getEl('lbl-obj-desc');
const btnRunObjAnalysis = getEl<HTMLButtonElement>('btn-run-obj-analysis');
const btnObjAnalysisText = getEl('btn-obj-analysis-text');
const objAnalysisResult = getEl<HTMLDivElement>('obj-analysis-result');
const angleInput = getEl<HTMLInputElement>('angle-input');
const multiViewBtn = getEl<HTMLButtonElement>('multiview-btn');
const lblAngleCount = getEl('lbl-angle-count');
const btnMultiViewText = getEl('btn-multiview-text');

// Custom Angle Elements
const lblCustomAngle = getEl('lbl-custom-angle');
const customAngleInput = getEl<HTMLTextAreaElement>('custom-angle-input');
const btnCustomAngle = getEl<HTMLButtonElement>('btn-custom-angle');
const btnCustomAngleText = getEl('btn-custom-angle-text');

// Modal Elements (Arrows)
const imageModal = getEl<HTMLDivElement>('image-modal');
const modalImg = getEl<HTMLImageElement>('modal-img');
const modalCanvas = getEl<HTMLCanvasElement>('modal-canvas');
const btnCloseModal = getEl<HTMLButtonElement>('btn-close-modal');
const btnClearDraw = getEl<HTMLButtonElement>('btn-clear-draw');

// Zoom Modal Elements
const zoomModal = getEl<HTMLDivElement>('zoom-modal');
const zoomImg = getEl<HTMLImageElement>('zoom-img');
const zoomCloseBtn = getEl<HTMLButtonElement>('zoom-close-btn');
const zoomDlBtn = getEl<HTMLButtonElement>('zoom-dl-btn');
const zoomPanContainer = getEl<HTMLDivElement>('zoom-pan-container');

// Language
const langToggleBtn = getEl<HTMLButtonElement>('lang-toggle-btn');
const langEnLabel = getEl('lang-en');
const langViLabel = getEl('lang-vi');

// --- Icons & UI Generators ---

const iconCopy = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
const iconDl = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
const iconDlAll = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;
const iconCopyAll = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>`;
const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
const iconTriangle = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;
const iconRemove = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;
const iconPngInfo = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;

// Helper: Create mini button
const createMiniBtn = (iconSvg: string, onClick: () => void, tooltip: string) => {
    const btn = document.createElement('button');
    btn.className = "p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors flex items-center justify-center";
    btn.title = tooltip;
    btn.innerHTML = iconSvg;
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick();
    };
    return btn;
};

// Helper: Rounded Rectangle for Canvas
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// Helper: Trigger Download
function triggerDownload(content: string, filename: string) {
    if(!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- PNG Info Utilities ---

// CRC table for PNG checksums
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
    }
    crcTable[n] = c;
}

function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
}

function writePngMetadata(originalPng: Uint8Array, key: string, value: string): Uint8Array {
    // Basic PNG chunk structure: Length (4) | Type (4) | Data (Length) | CRC (4)
    // tEXt data: Keyword | Null | Text
    
    const keyBytes = new TextEncoder().encode(key);
    const textBytes = new TextEncoder().encode(value);
    const chunkData = new Uint8Array(keyBytes.length + 1 + textBytes.length);
    chunkData.set(keyBytes, 0);
    chunkData[keyBytes.length] = 0; // Null separator
    chunkData.set(textBytes, keyBytes.length + 1);
    
    const len = chunkData.length;
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, len, false); // Big endian
    
    const typeBuf = new TextEncoder().encode("tEXt");
    
    const crcBuf = new Uint8Array(4);
    const crcCheck = new Uint8Array(typeBuf.length + chunkData.length);
    crcCheck.set(typeBuf, 0);
    crcCheck.set(chunkData, typeBuf.length);
    const crcVal = crc32(crcCheck);
    new DataView(crcBuf.buffer).setUint32(0, crcVal, false); // Big endian
    
    // Construct chunk
    const chunk = new Uint8Array(4 + 4 + len + 4);
    chunk.set(lenBuf, 0);
    chunk.set(typeBuf, 4);
    chunk.set(chunkData, 8);
    chunk.set(crcBuf, 8 + len);
    
    // Insert after IHDR
    if (originalPng[0] !== 137 || originalPng[1] !== 80 || originalPng[2] !== 78 || originalPng[3] !== 71) {
       console.error("Not a valid PNG");
       return originalPng;
    }

    let pos = 8;
    while(pos < originalPng.length) {
        const chunkLen = new DataView(originalPng.buffer).getUint32(pos);
        const type = String.fromCharCode(...originalPng.slice(pos + 4, pos + 8));
        
        if (type === 'IHDR') {
             const insertionPoint = pos + 8 + chunkLen + 4;
             const newPng = new Uint8Array(originalPng.length + chunk.length);
             newPng.set(originalPng.slice(0, insertionPoint), 0);
             newPng.set(chunk, insertionPoint);
             newPng.set(originalPng.slice(insertionPoint), insertionPoint + chunk.length);
             return newPng;
        }
        
        pos += 8 + chunkLen + 4;
    }
    
    return originalPng;
}

function extractPngMetadata(buffer: ArrayBuffer): string | null {
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);
    
    if (view.getUint32(0) !== 0x89504E47) return null;
    
    let offset = 8;
    while (offset < buffer.byteLength) {
        if (offset + 8 > buffer.byteLength) break;
        const length = view.getUint32(offset);
        if (offset + 8 + length + 4 > buffer.byteLength) break;

        const type = String.fromCharCode(...uint8.slice(offset + 4, offset + 8));
        
        if (type === 'tEXt') {
            const chunkData = uint8.slice(offset + 8, offset + 8 + length);
            let nullIndex = -1;
            for (let i = 0; i < chunkData.length; i++) {
                if (chunkData[i] === 0) {
                    nullIndex = i;
                    break;
                }
            }
            
            if (nullIndex > -1) {
                const keyword = new TextDecoder().decode(chunkData.slice(0, nullIndex));
                if (keyword === 'parameters') {
                    return new TextDecoder().decode(chunkData.slice(nullIndex + 1));
                }
                if (keyword === 'BananaProData') {
                    const jsonText = new TextDecoder().decode(chunkData.slice(nullIndex + 1));
                    return jsonText; // Return raw JSON string
                }
            }
        }
        
        offset += 12 + length;
        if (type === 'IEND') break;
    }
    return null;
}

function populateBananaData(data: any) {
    if (!lastAnalysisData) lastAnalysisData = {};
    const setField = (key: keyof AnalysisResult, val: string) => {
        if (!val) return;
        if (!lastAnalysisData![key]) lastAnalysisData![key] = { en: "", vi: "" };
        lastAnalysisData![key]!.en = val;
    };
    if(data.mega) setField('generationPrompt', data.mega);
    if(data.lighting) setField('lighting', data.lighting);
    if(data.scene) setField('context', data.scene);
    if(data.view) setField('composition', data.view);
    updateLanguageUI();
}

async function processBlobForMetadata(blob: Blob): Promise<boolean> {
    try {
        const buffer = await blob.arrayBuffer();
        const metadata = extractPngMetadata(buffer);
        if (!metadata) return false;
        const data = JSON.parse(metadata);
        populateBananaData(data);
        showStatus('Data loaded from image!');
        return true;
    } catch (e) {
        console.error("Error processing blob metadata", e);
        return false;
    }
}

// Logic to extract simple prompt string from PNG info for Text Overlay
async function getTextFromImage(blob: Blob): Promise<string> {
    try {
        const buffer = await blob.arrayBuffer();
        const metadata = extractPngMetadata(buffer);
        if (metadata) {
            try {
                const data = JSON.parse(metadata);
                // Priority: mega -> lighting+scene+view -> parameters
                if (data.mega) return data.mega;
                if (data.generationPrompt?.en) return data.generationPrompt.en;
                // Construct from pieces
                let parts = [];
                if(data.view) parts.push(data.view);
                if(data.scene) parts.push(data.scene);
                if(data.lighting) parts.push(data.lighting);
                if(parts.length > 0) return parts.join('\n\n');
            } catch(e) {
                // Not JSON, return raw text (WebUI params usually raw)
                return metadata;
            }
        }
        return "";
    } catch(e) { return ""; }
}


// --- Multi-View Card Generator (Synced with Text Overlay Style) ---
function createMultiViewCardHTML(id: string, title: string, content: string, composition: string, lighting: string, onDelete?: () => void): HTMLElement {
    const card = document.createElement('div');
    // Unified Style: Gray bg with 40% opacity, border gray-700
    card.className = "w-full border border-gray-700 rounded-xl bg-gray-900/40 relative transition hover:border-gray-500 mb-4 collapsible-card group";
    
    // Header (Clickable for Collapse)
    const header = document.createElement('div');
    header.className = "flex justify-between items-center p-3 border-b border-gray-700 cursor-pointer card-header select-none";
    
    const titleDiv = document.createElement('div');
    titleDiv.className = "flex items-center gap-2";
    
    const triangleIcon = document.createElement('div');
    triangleIcon.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
    triangleIcon.className = "chevron-icon text-yellow-500 transition-transform duration-200";
    
    const h3 = document.createElement('h3');
    // Unified Title Style
    h3.className = "text-xs font-bold text-gray-400 uppercase"; 
    h3.textContent = title;
    
    titleDiv.appendChild(triangleIcon);
    titleDiv.appendChild(h3);
    header.appendChild(titleDiv);
    
    // Collapsible Content Wrapper
    const cardContent = document.createElement('div');
    cardContent.className = "card-content flex"; // Flex row for sidebar + content

    // --- Vertical Actions Sidebar ---
    const sidebar = document.createElement('div');
    sidebar.className = "w-10 flex flex-col items-center gap-2 py-3 bg-gray-800/30 border-r border-gray-700 shrink-0";
    
    // Copy All Button
    const btnCopy = document.createElement('button');
    btnCopy.className = "p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-all";
    btnCopy.title = "Copy All";
    btnCopy.innerHTML = iconCopyAll;
    btnCopy.onclick = async (e) => {
        e.stopPropagation();
        const fullText = `[DETAILED CONTENT]:\n${content}\n\n[COMPOSITION & ANGLE]:\n${composition}\n\n[LIGHTING]:\n${lighting}`;
        try { await navigator.clipboard.writeText(fullText); showStatus("Copied all 3 sections!"); setTimeout(() => showStatus(''), 2000); } catch(e) { showStatus("Copy failed", true); }
    };

    // PNG Info Button
    const btnPngInfo = document.createElement('button');
    btnPngInfo.className = "p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-all";
    btnPngInfo.title = "Copy Data PNG Info";
    btnPngInfo.innerHTML = iconPngInfo;
    btnPngInfo.onclick = async (e) => {
        e.stopPropagation();
        const bananaData = {
            mega: content,
            lighting: lighting,
            scene: "", 
            view: composition,
            inpaint: "",
            inpaintEnabled: false,
            cameraProjection: false
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(bananaData, null, 2));
            showStatus("Copied PNG Info (JSON)!");
            setTimeout(() => showStatus(''), 2000);
        } catch(e) { showStatus("Copy failed", true); }
    };

    // Download Button
    const btnDownload = document.createElement('button');
    btnDownload.className = "p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-all";
    btnDownload.title = "Download All";
    btnDownload.innerHTML = iconDlAll;
    btnDownload.onclick = (e) => {
         e.stopPropagation();
         triggerDownload(content, `${title.replace(/\s+/g, '_')}_Content.txt`);
         setTimeout(() => triggerDownload(composition, `${title.replace(/\s+/g, '_')}_Composition.txt`), 300);
         setTimeout(() => triggerDownload(lighting, `${title.replace(/\s+/g, '_')}_Lighting.txt`), 600);
    };

    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = "p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all";
    btnDelete.title = "Delete View";
    btnDelete.innerHTML = iconTrash;
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        card.style.opacity = '0';
        setTimeout(() => { card.remove(); if (onDelete) onDelete(); }, 300);
    };

    sidebar.appendChild(btnCopy); 
    sidebar.appendChild(btnPngInfo); 
    sidebar.appendChild(btnDownload); 
    sidebar.appendChild(btnDelete);
    
    // --- Main Content Area ---
    const contentArea = document.createElement('div');
    contentArea.className = "flex-1 p-4 overflow-hidden";
    
    const gridDiv = document.createElement('div');
    gridDiv.className = "grid grid-cols-1 md:grid-cols-3 gap-4";
    
    const createSection = (sectionTitle: string, sectionText: string, colorClass: string) => {
        const col = document.createElement('div');
        // Keep section color coding but ensure it fits the new container
        col.className = `p-4 rounded-lg border flex flex-col h-full bg-opacity-10 ${colorClass}`;
        if(colorClass.includes('blue')) col.classList.add('bg-blue-900', 'border-blue-500/20');
        else if(colorClass.includes('purple')) col.classList.add('bg-purple-900', 'border-purple-500/20');
        else if(colorClass.includes('orange')) col.classList.add('bg-orange-900', 'border-orange-500/20');
        else col.classList.add('bg-gray-800', 'border-gray-700');
        const secHeader = document.createElement('div');
        secHeader.className = "flex justify-between items-center mb-2";
        const secH = document.createElement('h5');
        secH.className = "font-bold text-xs uppercase tracking-wider opacity-90 text-white";
        secH.textContent = sectionTitle;
        const actions = document.createElement('div');
        actions.className = "flex gap-1";
        actions.appendChild(createMiniBtn(iconCopy, async () => { await navigator.clipboard.writeText(sectionText); showStatus(`Copied ${sectionTitle}`); setTimeout(() => showStatus(''), 2000); }, "Copy"));
        secHeader.appendChild(secH); secHeader.appendChild(actions);
        const p = document.createElement('p');
        p.className = "text-gray-300 text-sm whitespace-pre-line font-mono mt-1";
        p.textContent = sectionText;
        col.appendChild(secHeader); col.appendChild(p);
        return col;
    };
    
    gridDiv.appendChild(createSection("Detailed Content", content, "blue"));
    gridDiv.appendChild(createSection("Composition & Angle", composition, "purple"));
    gridDiv.appendChild(createSection("Lighting", lighting, "orange"));
    
    contentArea.appendChild(gridDiv);
    
    cardContent.appendChild(sidebar);
    cardContent.appendChild(contentArea);
    
    card.appendChild(header);
    card.appendChild(cardContent);
    
    // Attach collapse listener immediately
    header.addEventListener('click', () => {
        card.classList.toggle('card-collapsed');
    });

    return card;
}

// --- API & Core Functions ---

async function openApiKeyDialog() {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    showStatus('API key selection is not available.', true);
  }
}

function showStatus(message: string, isError = false) {
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.className = isError 
    ? 'text-center text-xs text-red-400 h-4 truncate font-bold' 
    : 'text-center text-xs text-gray-500 h-4 truncate';
  
  // Auto clear after 5 seconds
  setTimeout(() => {
    if (statusMsg.textContent === message) {
        statusMsg.textContent = '';
    }
  }, 5000);
}

function handleApiError(e: any, defaultMsg: string = "Error") {
    console.error(e);
    let msg = defaultMsg;
    
    // Check for 429 / Quota / Resource Exhausted
    const eStr = e.toString() + (e.message || "") + JSON.stringify(e);
    if (eStr.includes("429") || eStr.includes("RESOURCE_EXHAUSTED") || eStr.includes("quota")) {
        msg = "Quota exceeded (429). Check your billing or wait.";
    } else if (eStr.includes("503") || eStr.includes("overloaded")) {
        msg = "Server overloaded (503). Retrying might help.";
    } else if (e.message) {
        msg = `Error: ${e.message.substring(0, 40)}${e.message.length > 40 ? '...' : ''}`;
    }
    
    showStatus(msg, true);
}

function setLoading(isLoading: boolean) {
  if (isLoading) {
    setHidden(loader, false);
    if(analyzeBtn) analyzeBtn.disabled = true;
    if(multiViewBtn) multiViewBtn.disabled = true;
    if(btnRunObjAnalysis) btnRunObjAnalysis.disabled = true;
    if(analyzeNotesBtn) analyzeNotesBtn.disabled = true;
    if(btnLoadPngInfo) btnLoadPngInfo.disabled = true;
    if(dropZone) addClass(dropZone, 'pointer-events-none');
    if(resultsContainer) addClass(resultsContainer, 'opacity-50', 'pointer-events-none');
  } else {
    setHidden(loader, true);
    if(analyzeBtn) analyzeBtn.disabled = false;
    if(multiViewBtn) multiViewBtn.disabled = false;
    if(btnRunObjAnalysis) btnRunObjAnalysis.disabled = false;
    if(analyzeNotesBtn) analyzeNotesBtn.disabled = false;
    if(btnLoadPngInfo) btnLoadPngInfo.disabled = false;
    if(dropZone) removeClass(dropZone, 'pointer-events-none');
    if(resultsContainer) removeClass(resultsContainer, 'opacity-50', 'pointer-events-none');
  }
}

async function fileToGenerativePart(file: File): Promise<{
  inlineData: {data: string; mimeType: string};
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: { data: base64Content, mimeType: file.type },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Image processing (Canvas arrows burning)
async function processFileForGemini(file: File): Promise<{
  inlineData: {data: string; mimeType: string};
}> {
    const arrows = fileArrowMap.get(file);
    if (!arrows || arrows.length === 0) {
        return fileToGenerativePart(file);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if(!ctx) { resolve(fileToGenerativePart(file)); return; }

            ctx.drawImage(img, 0, 0);
            arrows.forEach(arrow => {
                const x1 = arrow.nx1 * canvas.width;
                const y1 = arrow.ny1 * canvas.height;
                const x2 = arrow.nx2 * canvas.width;
                const y2 = arrow.ny2 * canvas.height;
                // Draw Arrow Logic
                const headLength = Math.max(15, canvas.width * 0.03); 
                const dx = x2 - x1;
                const dy = y2 - y1;
                const angle = Math.atan2(dy, dx);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineWidth = Math.max(3, canvas.width * 0.005);
                ctx.strokeStyle = '#ff0000';
                ctx.stroke();
                // Head
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
                ctx.lineTo(x2, y2);
                ctx.fillStyle = '#ff0000';
                ctx.fill();
                // Dot
                ctx.beginPath();
                ctx.arc(x1, y1, Math.max(5, canvas.width * 0.008), 0, Math.PI * 2);
                ctx.fillStyle = '#ff0000';
                ctx.fill();
            });

            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const base64Content = dataUrl.split(',')[1];
            resolve({ inlineData: { data: base64Content, mimeType: 'image/jpeg' } });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Wrapper for exponential backoff retry
async function generateContentWithRetry(ai: GoogleGenAI, params: any, retries = 3, delay = 1000): Promise<any> {
    try {
        return await ai.models.generateContent(params);
    } catch (e: any) {
        if (retries > 0) {
            const eStr = e.toString() + (e.message || "") + JSON.stringify(e);
            // Retry on 429 (Quota) or 503 (Overloaded)
            if (eStr.includes("429") || eStr.includes("RESOURCE_EXHAUSTED") || eStr.includes("503") || eStr.includes("overloaded")) {
                console.warn(`API Error ${e.status || 'unknown'}. Retrying in ${delay}ms... (${retries} retries left)`);
                // Wait for delay
                await new Promise(resolve => setTimeout(resolve, delay));
                // Retry with double delay
                return generateContentWithRetry(ai, params, retries - 1, delay * 2);
            }
        }
        throw e;
    }
}

async function callGemini(prompt: string, files: File[]): Promise<string> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) { await openApiKeyDialog(); return "{}"; }

    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    for (const file of files) {
        parts.push(await processFileForGemini(file));
    }
    if (activeTab === 'analysis' && currentSketchFile) {
        parts.push(await processFileForGemini(currentSketchFile));
    }
    parts.push({ text: prompt });

    // Use retry wrapper
    const response = await generateContentWithRetry(ai, {
        model: 'gemini-3-flash-preview',
        contents: { parts: parts },
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
}

// --- UI Logic ---

function updateLanguageUI() {
    const t = translations[currentLang];
    
    // Static Text
    setText(appTitle, t.appTitle);
    setText(appSubtitle, t.appSubtitle);
    setText(lblUpload, t.uploadTitle);
    setText(lblDrag, t.uploadDrag);
    setText(lblUploadSketch, t.uploadSketch);
    setText(btnAnalyzeText, t.btnAnalyze);
    setText(btnDownloadAllText, t.btnDownloadAll);
    setText(btnLoadPngInfoText, t.btnLoadPngInfo);
    setText(loaderTitle, t.loaderTitle);
    setText(loaderSubtitle, t.loaderSubtitle);
    if(tabAnalysis) setText(tabAnalysis, t.tabAnalysis);
    if(tabMultiView) setText(tabMultiView, t.tabMultiView);
    if(tabNotes) setText(tabNotes, t.tabNotes);
    if(tabTextOverlay) setText(tabTextOverlay, t.tabTextOverlay);
    setText(lblAngleCount, t.lblAngleCount);
    setText(lblCustomAngle, t.lblCustomAngle);
    if(customAngleInput) customAngleInput.placeholder = t.customAnglePlaceholder;
    setText(btnCustomAngleText, t.btnCustomAngle);
    setText(lblObjAnalysis, t.lblObjAnalysis);
    setText(lblObjDesc, t.lblObjDesc);
    setText(btnObjAnalysisText, t.btnObjAnalysis);
    setText(btnAnalyzeNotesText, t.btnAnalyzeNotes);
    setText(btnMultiViewText, t.btnMultiView);

    setText(titleStyle, t.titles.style);
    setText(titleMaterial, t.titles.materials);
    setText(titleLighting, t.titles.lighting);
    setText(titleContext, t.titles.context);
    setText(titleComposition, t.titles.composition);
    setText(titlePrompt, t.titles.generationPrompt);
    setText(titleSketchPrompt, t.titles.sketchPrompt);

    // Tab Logic
    setHidden(panelAnalysis, true);
    setHidden(panelMultiView, true);
    setHidden(panelNotes, true);
    setHidden(panelUploadAnalysis, true);
    setHidden(sketchContainer, true);
    setHidden(multiviewContextContainer, true);
    setHidden(panelTextOverlaySettings, true);
    
    setHidden(analysisCardsWrapper, true);
    setHidden(multiviewResults, true);
    setHidden(notesResults, true);
    setHidden(overlayGrid, true);
    
    // Hide Global Action Bar by default
    setHidden(globalActionsBar, true);

    removeClass(tabAnalysis, 'active');
    removeClass(tabMultiView, 'active');
    removeClass(tabNotes, 'active');
    removeClass(tabTextOverlay, 'active');

    if (activeTab === 'analysis') {
        setHidden(panelAnalysis, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(sketchContainer, false);
        setHidden(analysisCardsWrapper, false);
        setHidden(globalActionsBar, false);
        addClass(tabAnalysis, 'active');

    } else if (activeTab === 'multiview') {
        setHidden(panelMultiView, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(multiviewContextContainer, false);
        setHidden(multiviewResults, false);
        setHidden(globalActionsBar, false);
        addClass(tabMultiView, 'active');

    } else if (activeTab === 'notes') {
        setHidden(panelNotes, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(notesResults, false);
        setHidden(globalActionsBar, false);
        addClass(tabNotes, 'active');
    
    } else if (activeTab === 'textOverlay') {
        setHidden(panelTextOverlaySettings, false);
        setHidden(overlayGrid, false);
        addClass(tabTextOverlay, 'active');
        if (overlaySlots.length === 0) initOverlaySlots();
        renderOverlaySlots();
        setHidden(globalActionsBar, false); // Visible for Text Overlay too
    }

    // Single Analysis Content
    if (lastAnalysisData) {
        if(resStyle) setText(resStyle, lastAnalysisData.style?.[currentLang] || "");
        if(resMaterial) setText(resMaterial, lastAnalysisData.materials?.[currentLang] || "");
        if(resLighting) setText(resLighting, lastAnalysisData.lighting?.[currentLang] || "");
        if(resContext) setText(resContext, lastAnalysisData.context?.[currentLang] || "");
        if(resComposition) setText(resComposition, lastAnalysisData.composition?.[currentLang] || "");
        if(resPrompt) setText(resPrompt, lastAnalysisData.generationPrompt?.[currentLang] || "");
        if(resSketchPrompt) setText(resSketchPrompt, lastAnalysisData.sketchPrompt?.[currentLang] || "");
    }

    // Render Logic for Views and Notes handled in respective functions
    if(activeTab === 'multiview') renderMultiViewResults();
    if(activeTab === 'notes') renderNotesResults();

    // Lang Toggle Style
    if (langEnLabel && langViLabel) {
        if (currentLang === 'en') {
            langEnLabel.classList.add('text-white', 'font-bold');
            langEnLabel.classList.remove('text-gray-400');
            langViLabel.classList.add('text-gray-400');
            langViLabel.classList.remove('text-white', 'font-bold');
        } else {
            langViLabel.classList.add('text-white', 'font-bold');
            langViLabel.classList.remove('text-gray-400');
            langEnLabel.classList.add('text-gray-400');
            langEnLabel.classList.remove('text-white', 'font-bold');
        }
    }
}

// Collapsible Logic for Static Analysis Cards
function setupCollapsibleCards() {
    const cards = document.querySelectorAll('.collapsible-card');
    cards.forEach(card => {
        const header = card.querySelector('.card-header');
        if (header) {
            // Remove existing listener to prevent duplicates
            const newHeader = header.cloneNode(true) as HTMLElement;
            header.parentNode?.replaceChild(newHeader, header);
            
            newHeader.addEventListener('click', () => {
                card.classList.toggle('card-collapsed');
            });
        }
    });
}

// Re-run setup whenever UI updates might affect static HTML
// (Note: renderMultiViewResults creates new elements, so it handles its own listeners if needed, 
// but currently createMultiViewCardHTML has built-in logic)

function renderMultiViewResults() {
    if (!multiviewResults) return;
    multiviewResults.innerHTML = '';
    
    // 1. Custom Angles History
    if (customAnglesHistory.length > 0) {
        [...customAnglesHistory].reverse().forEach((entry, idx) => {
             const realIndex = customAnglesHistory.length - 1 - idx;
             const data = entry[currentLang];
             if(data) {
                const card = createMultiViewCardHTML(
                    `custom-${idx}`, data.title, data.content, data.composition, data.lighting,
                    () => { customAnglesHistory.splice(realIndex, 1); updateLanguageUI(); }
                );
                multiviewResults.appendChild(card);
             }
        });
    }

    // 2. Batch Analysis
    if (lastAnalysisData && lastAnalysisData.multiViewPrompts) {
         const mvData = lastAnalysisData.multiViewPrompts[currentLang] || "";
         if (mvData) {
             const sections = mvData.split('===ANGLE:');
             sections.forEach((sec, idx) => {
                 if(!sec.trim()) return;
                 const lines = sec.split('\n');
                 const angleTitle = lines[0].trim().replace('===', '');
                 
                 let content = "";
                 let composition = "";
                 let lighting = "";
                 
                 const contentIdx = sec.indexOf('[CONTENT]:');
                 const compIdx = sec.indexOf('[COMPOSITION]:');
                 const lightIdx = sec.indexOf('[LIGHTING]:');
                 
                 if (contentIdx !== -1) {
                     const end = compIdx !== -1 ? compIdx : (lightIdx !== -1 ? lightIdx : sec.length);
                     content = sec.substring(contentIdx + 10, end).trim();
                 }
                 if (compIdx !== -1) {
                     const end = lightIdx !== -1 ? lightIdx : sec.length;
                     composition = sec.substring(compIdx + 14, end).trim();
                 }
                 if (lightIdx !== -1) {
                     lighting = sec.substring(lightIdx + 11).trim();
                 }
                 
                 if(angleTitle) {
                    const card = createMultiViewCardHTML(
                        `mv-${idx}`, angleTitle, content, composition, lighting
                    );
                    multiviewResults.appendChild(card);
                 }
             });
         }
    }
}

function renderNotesResults() {
    if (!notesResults) return;
    if (notesHistory.length === 0) {
        notesResults.innerHTML = `
        <div class="text-center py-12 text-gray-600">
             ${currentLang === 'en' ? 'Upload images and click "Extract & Translate Notes" to begin.' : 'Tải ảnh lên và nhấn "Trích Xuất & Dịch Ghi Chú" để bắt đầu.'}
        </div>`;
        return;
    }

    notesResults.innerHTML = '';
    notesHistory.forEach((note, idx) => {
        const card = document.createElement('div');
        // Unified Style: Gray bg with 40% opacity, border gray-700
        card.className = "w-full border border-gray-700 rounded-xl bg-gray-900/40 relative transition hover:border-gray-500 mb-4 collapsible-card group";
        
        // Header
        const header = document.createElement('div');
        header.className = "flex justify-between items-center p-3 border-b border-gray-700 cursor-pointer card-header select-none";
        header.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="chevron-icon text-yellow-500 mr-1"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></span>
                <h3 class="text-xs font-bold text-gray-400 uppercase">Note #${idx+1}: ${note.file.name}</h3>
            </div>
        `;
        header.onclick = () => card.classList.toggle('card-collapsed');

        // Content
        const content = document.createElement('div');
        content.className = "card-content p-4";
        
        const row = document.createElement('div');
        row.className = "flex flex-col md:flex-row gap-4 overflow-hidden";
        
        // Col 1: Image
        const imgContainer = document.createElement('div');
        imgContainer.className = "w-full md:w-1/4 shrink-0 relative group cursor-pointer border border-gray-700 rounded-lg overflow-hidden bg-black";
        const img = document.createElement('img');
        img.src = URL.createObjectURL(note.file);
        img.className = "w-full h-48 md:h-full object-contain hover:scale-105 transition-transform duration-300";
        img.onclick = (e) => { e.stopPropagation(); openModal(note.file, img.src); };
        
        const zoomHint = document.createElement('div');
        zoomHint.className = "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none";
        zoomHint.innerHTML = `<svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>`;
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(zoomHint);
        
        // Helper to create content column
        const createContentCol = (title: string, text: string, color: string) => {
            const col = document.createElement('div');
            col.className = "flex-1 flex border border-gray-800 rounded-lg overflow-hidden bg-gray-900/30";
            
            // Sidebar
            const sidebar = document.createElement('div');
            sidebar.className = "w-10 flex flex-col items-center gap-2 py-3 bg-gray-800/50 border-r border-gray-800";
            
            // Copy Btn
            const copyBtn = document.createElement('button');
            copyBtn.className = `p-1.5 text-gray-500 hover:text-${color}-400 hover:bg-${color}-500/10 rounded transition`;
            copyBtn.innerHTML = iconCopy;
            copyBtn.onclick = async (e) => {
                 e.stopPropagation();
                 try { await navigator.clipboard.writeText(text); showStatus('Copied!'); setTimeout(()=>showStatus(''), 2000); } catch(e){}
            };
            
            // Download Btn
            const dlBtn = document.createElement('button');
            dlBtn.className = `p-1.5 text-gray-500 hover:text-${color}-400 hover:bg-${color}-500/10 rounded transition`;
            dlBtn.innerHTML = iconDl;
            dlBtn.onclick = (e) => { e.stopPropagation(); triggerDownload(text, `Note_${title}.txt`); };

            sidebar.appendChild(copyBtn);
            sidebar.appendChild(dlBtn);
            
            // Text Content
            const contentDiv = document.createElement('div');
            contentDiv.className = "flex-1 p-3";
            const h4 = document.createElement('h4');
            h4.className = `text-xs font-bold text-${color}-400 mb-2 uppercase`;
            h4.textContent = title;
            const p = document.createElement('p');
            p.className = "text-sm text-gray-300 font-mono whitespace-pre-wrap leading-relaxed";
            p.textContent = text;
            
            contentDiv.appendChild(h4);
            contentDiv.appendChild(p);
            
            col.appendChild(sidebar);
            col.appendChild(contentDiv);
            return col;
        }

        const viCol = createContentCol("Tiếng Việt", note.vi, "green");
        const enCol = createContentCol("English", note.en, "blue");

        row.appendChild(imgContainer);
        row.appendChild(viCol);
        row.appendChild(enCol);
        
        content.appendChild(row);
        card.appendChild(header);
        card.appendChild(content);
        
        notesResults.appendChild(card);
    });
}

// --- Text Overlay Grid Logic ---

function initOverlaySlots() {
    overlaySlots = [];
    for (let i = 0; i < 5; i++) {
        overlaySlots.push(createEmptySlot());
    }
}

function createEmptySlot(): OverlaySlot {
    return {
        id: Math.random().toString(36).substr(2, 9),
        file: null,
        imgSrc: null,
        text: "",
        isDarkText: false,
        resultSrc: null,
        isTranslating: false,
        originalName: null
    };
}

function renderOverlaySlots() {
    if (!overlayGrid) return;
    overlayGrid.innerHTML = '';
    
    overlaySlots.forEach((slot, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = "w-full border border-gray-700 rounded-xl bg-gray-900/40 relative transition hover:border-gray-500 mb-4 collapsible-card group";
        
        // Header
        const header = document.createElement('div');
        header.className = "flex justify-between items-center p-3 border-b border-gray-700 cursor-pointer card-header select-none";
        
        const titleDiv = document.createElement('div');
        titleDiv.className = "flex items-center gap-2";
        const triangleIcon = document.createElement('div');
        triangleIcon.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
        triangleIcon.className = "chevron-icon text-yellow-500 transition-transform duration-200";
        const span = document.createElement('span');
        span.className = "text-xs font-bold text-gray-400 uppercase";
        span.innerText = `Slot ${index + 1}`;
        titleDiv.appendChild(triangleIcon);
        titleDiv.appendChild(span);
        header.appendChild(titleDiv);

        if (overlaySlots.length > 5) { 
             const delBtn = document.createElement('button');
             delBtn.className = "text-xs text-red-500 hover:text-red-300 px-2";
             delBtn.innerHTML = "×";
             delBtn.onclick = (e) => {
                 e.stopPropagation();
                 overlaySlots.splice(index, 1);
                 renderOverlaySlots();
             };
             header.appendChild(delBtn);
        }
        
        header.onclick = () => slotEl.classList.toggle('card-collapsed');
        slotEl.appendChild(header);

        // Content
        const cardContent = document.createElement('div');
        cardContent.className = "card-content p-4";

        // Grid Content (3 columns horizontal)
        const gridContent = document.createElement('div');
        gridContent.className = "grid grid-cols-1 lg:grid-cols-3 gap-4";

        // --- Column 1: Upload / Preview ---
        const colUpload = document.createElement('div');
        colUpload.className = "flex flex-col gap-2";
        colUpload.innerHTML = `<label class="text-[10px] text-gray-500 font-bold uppercase">1. Source Image</label>`;
        
        const imgZone = document.createElement('div');
        imgZone.className = "flex-1 min-h-[300px] rounded-lg bg-black border border-gray-800 relative overflow-hidden group/zone cursor-pointer flex items-center justify-center";
        
        if (slot.imgSrc) {
            const img = document.createElement('img');
            img.src = slot.imgSrc;
            img.className = "w-full h-full object-contain opacity-90";
            const clearImgBtn = document.createElement('button');
            clearImgBtn.className = "absolute top-1 right-1 bg-red-600/80 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover/zone:opacity-100 transition-opacity z-10";
            clearImgBtn.innerHTML = "×";
            clearImgBtn.onclick = (e) => {
                e.stopPropagation();
                updateSlot(index, { imgSrc: null, file: null, resultSrc: null, text: "", originalName: null });
            };
            imgZone.appendChild(img);
            imgZone.appendChild(clearImgBtn);
        } else {
            imgZone.innerHTML = `<p class="text-xs text-gray-500 text-center px-2">Click/Drop Image</p>`;
            imgZone.classList.add("border-dashed", "hover:bg-gray-800");
        }
        
        const slotInput = document.createElement('input');
        slotInput.type = "file";
        slotInput.accept = "image/*";
        slotInput.className = "hidden";
        slotInput.onchange = async (e) => {
             const f = (e.target as HTMLInputElement).files?.[0];
             if (f) await handleSlotFile(index, f);
        };
        
        if (!slot.imgSrc) {
            imgZone.onclick = () => slotInput.click();
        }
        
        imgZone.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); imgZone.classList.add('border-blue-500'); };
        imgZone.ondragleave = (e) => { e.preventDefault(); e.stopPropagation(); imgZone.classList.remove('border-blue-500'); };
        imgZone.ondrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            imgZone.classList.remove('border-blue-500');
            const f = e.dataTransfer?.files[0];
            if (f && f.type.startsWith('image/')) await handleSlotFile(index, f);
        };

        colUpload.appendChild(imgZone);
        colUpload.appendChild(slotInput);

        // --- Column 2: Text / Edit ---
        const colEdit = document.createElement('div');
        colEdit.className = "flex flex-col gap-2";
        colEdit.innerHTML = `<label class="text-[10px] text-gray-500 font-bold uppercase">2. Edit Text</label>`;
        
        const textArea = document.createElement('textarea');
        textArea.className = "flex-1 h-64 bg-black/30 border border-gray-700 rounded p-3 text-sm text-white focus:border-yellow-500 outline-none resize-none overlay-textarea";
        textArea.setAttribute('data-slot-index', index.toString()); // For keyboard shortcut
        textArea.style.fontFamily = `"${globalFont}", sans-serif`;
        textArea.placeholder = "Enter overlay text here...";
        textArea.value = slot.text;
        textArea.oninput = (e) => {
            updateSlot(index, { text: (e.target as HTMLTextAreaElement).value }, false);
        };
        if(slot.isTranslating) {
            textArea.disabled = true;
            textArea.classList.add('opacity-50', 'animate-pulse');
        }
        
        const controls = document.createElement('div');
        controls.className = "flex gap-2 mt-auto h-8";
        
        const themeBtn = document.createElement('button');
        themeBtn.className = `flex-1 rounded border text-[10px] font-bold transition-colors ${slot.isDarkText ? 'bg-gray-200 text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-600'}`;
        themeBtn.innerText = slot.isDarkText ? "Dark Text" : "Light Text";
        themeBtn.onclick = () => updateSlot(index, { isDarkText: !slot.isDarkText });

        const translateBtn = document.createElement('button');
        translateBtn.className = "w-10 rounded border border-blue-600 bg-blue-900/30 text-blue-400 hover:bg-blue-800 hover:text-white flex items-center justify-center transition-colors";
        translateBtn.title = "Translate (VN/EN)";
        translateBtn.innerHTML = slot.isTranslating 
            ? `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>`;
        translateBtn.onclick = () => handleTranslate(index);
        
        const embedBtn = document.createElement('button');
        embedBtn.className = "flex-1 rounded border border-yellow-600 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-black font-bold text-[10px] uppercase transition-colors";
        embedBtn.innerText = "Embed";
        embedBtn.onclick = () => processSlotEmbed(index);

        controls.appendChild(themeBtn);
        controls.appendChild(translateBtn);
        controls.appendChild(embedBtn);
        colEdit.appendChild(textArea);
        colEdit.appendChild(controls);

        // --- Column 3: Result ---
        const colResult = document.createElement('div');
        colResult.className = "flex flex-col gap-2";
        colResult.innerHTML = `<label class="text-[10px] text-green-500 font-bold uppercase">3. Result Output</label>`;
        
        const resultImgZone = document.createElement('div');
        resultImgZone.className = "flex-1 min-h-[300px] rounded-lg bg-black border border-gray-700 relative overflow-hidden flex items-center justify-center";
        
        if (slot.resultSrc) {
            resultImgZone.classList.add("cursor-zoom-in", "group/zone");
            resultImgZone.onclick = () => openZoomModal(slot.resultSrc!);
            
            const resImg = document.createElement('img');
            resImg.src = slot.resultSrc;
            resImg.className = "w-full h-full object-contain";
            
            const zoomOverlay = document.createElement('div');
            zoomOverlay.className = "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/zone:opacity-100 transition-opacity pointer-events-none";
            zoomOverlay.innerHTML = `<span class="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Zoom</span>`;
            
            const dlBtn = document.createElement('button');
            dlBtn.className = "absolute top-1 right-1 bg-green-600/90 text-white p-1 rounded transition-colors z-10 pointer-events-auto hover:bg-green-500";
            dlBtn.title = "Download";
            dlBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
            dlBtn.onclick = (e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = slot.resultSrc!;
                // Auto name logic: Overlay_OriginalName.png
                const originalBase = slot.originalName ? slot.originalName.replace(/\.[^/.]+$/, "") : `Result_${index + 1}`;
                a.download = `Overlay_${originalBase}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

            resultImgZone.appendChild(resImg);
            resultImgZone.appendChild(zoomOverlay);
            resultImgZone.appendChild(dlBtn);
        } else {
            resultImgZone.innerHTML = `<p class="text-xs text-gray-600 italic">Waiting for embed...</p>`;
        }
        
        colResult.appendChild(resultImgZone);

        gridContent.appendChild(colUpload);
        gridContent.appendChild(colEdit);
        gridContent.appendChild(colResult);
        
        cardContent.appendChild(gridContent);
        slotEl.appendChild(cardContent);
        overlayGrid.appendChild(slotEl);
    });
}

function updateSlot(index: number, updates: Partial<OverlaySlot>, shouldRender = true) {
    if (!overlaySlots[index]) return;
    overlaySlots[index] = { ...overlaySlots[index], ...updates };
    if (shouldRender) renderOverlaySlots();
}

async function handleSlotFile(index: number, file: File) {
    const src = URL.createObjectURL(file);
    const text = await getTextFromImage(file);
    updateSlot(index, { file, imgSrc: src, text: text || overlaySlots[index].text, originalName: file.name });
}

// Translate Function
async function handleTranslate(index: number) {
    const text = overlaySlots[index].text.trim();
    if (!text) return;

    updateSlot(index, { isTranslating: true });
    
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) { await openApiKeyDialog(); updateSlot(index, { isTranslating: false }); return; }
        const ai = new GoogleGenAI({ apiKey });
        
        // Use retry wrapper
        const response = await generateContentWithRetry(ai, {
            model: "gemini-3-flash-preview",
            contents: `Translate the following text to English if it is Vietnamese, or to Vietnamese if it is English. Maintain the tone and style. Return ONLY the translated text.\n\nText: ${text}`,
        });
        
        const translated = response.text || text;
        updateSlot(index, { text: translated, isTranslating: false });
        showStatus('Translated!');
    } catch (e) {
        handleApiError(e, 'Translation failed');
        updateSlot(index, { isTranslating: false });
    }
}

// Embed Function (Canvas based)
function processSlotEmbed(index: number) {
    const slot = overlaySlots[index];
    if (!slot.file || !slot.imgSrc) { showStatus('No image in slot!', true); return; }

    const img = new Image();
    img.src = slot.imgSrc;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        // Draw Base Image
        ctx.drawImage(img, 0, 0);

        // 1/3 Height Logic
        const boxHeight = Math.floor(canvas.height / 3);
        const boxY = canvas.height - boxHeight;
        const padding = Math.floor(canvas.width * 0.05);
        const maxWidth = canvas.width - (padding * 2);
        const maxHeight = boxHeight - (padding * 2);

        // Helper for asynchronous drawing steps (logo loading)
        const drawContent = () => {
            // Draw Text Box Background (More Transparent: 0.3 - 0.7)
            const grad = ctx.createLinearGradient(0, boxY, 0, canvas.height);
            const bgColor = slot.isDarkText ? "255, 255, 255" : "0, 0, 0";
            grad.addColorStop(0, `rgba(${bgColor}, 0.3)`); 
            grad.addColorStop(1, `rgba(${bgColor}, 0.7)`);
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, boxY, canvas.width, boxHeight);

            // Text Drawing with Auto-Scaling 
            const text = slot.text.trim();
            if(text) {
                // Increased base font size (smaller divisor = bigger text)
                // Was 50, now 42 for a slight increase
                let fontSize = Math.floor(canvas.width / 42); 
                const minFontSize = Math.floor(canvas.width / 100); 
                
                ctx.font = `bold ${fontSize}px "${globalFont}", sans-serif`;
                
                // Helper to measure height
                const measureTextHeight = (fs: number) => {
                    ctx.font = `bold ${fs}px "${globalFont}", sans-serif`;
                    const lineHeight = fs * 1.4;
                    const pars = text.split('\n');
                    let lines = 0;
                    pars.forEach(p => {
                        const words = p.split(' ');
                        let l = '';
                        for(let n=0; n<words.length; n++) {
                            const tm = ctx.measureText(l + words[n] + ' ');
                            if(tm.width > maxWidth && n > 0) { lines++; l = words[n] + ' '; }
                            else { l += words[n] + ' '; }
                        }
                        lines++;
                    });
                    return lines * lineHeight;
                };

                // Loop to shrink font if it doesn't fit
                while (measureTextHeight(fontSize) > maxHeight && fontSize > minFontSize) {
                    fontSize -= 2;
                }

                // Draw Text
                ctx.font = `bold ${fontSize}px "${globalFont}", sans-serif`;
                ctx.fillStyle = slot.isDarkText ? '#1a1a1a' : '#ffffff';
                ctx.shadowColor = slot.isDarkText ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.textBaseline = 'top';
                
                const lineHeight = fontSize * 1.4;
                // Position high up, near the top of the box (boxY)
                // Minimal top padding (0.3 of normal padding)
                let currentY = boxY + (padding * 0.3);
                
                wrapText(ctx, text, padding, currentY, maxWidth, lineHeight);
            }

            // Global Signature Logic (Rounded Box, Dynamic Color)
            if (globalSignature.trim()) {
                 const sigSize = Math.max(14, Math.floor(canvas.width / 60)); 
                 ctx.font = `bold italic ${sigSize}px "${globalFont}", sans-serif`;
                 
                 const sigText = globalSignature;
                 const paddingX = sigSize * 0.8;
                 const paddingY = sigSize * 0.5;
                 
                 const metrics = ctx.measureText(sigText);
                 const textWidth = metrics.width;
                 const textHeight = sigSize; // approx baseline height
                 
                 // Positions (Bottom Right with margin)
                 const rightMargin = canvas.width * 0.03;
                 const bottomMargin = canvas.width * 0.03;
                 
                 const rectWidth = textWidth + (paddingX * 2);
                 const rectHeight = textHeight + (paddingY * 2);
                 
                 const rectX = canvas.width - rightMargin - rectWidth;
                 const rectY = canvas.height - bottomMargin - rectHeight;
                 
                 // Draw Background Box with Rounded Corners and Dynamic Color
                 ctx.shadowBlur = 4;
                 ctx.shadowColor = 'rgba(0,0,0,0.3)';
                 ctx.fillStyle = hexToRgba(globalSigBgColor, 0.85); // Use 85% opacity
                 
                 const cornerRadius = rectHeight / 2; // Fully rounded sides
                 roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 8); // 8px radius
                 
                 // Determine Text Color for Contrast
                 const bgHex = globalSigBgColor.toUpperCase();
                 // Simple contrast check: White/Gold/Red/Blue -> Black or White logic
                 // For now, simple manual logic: Black/Red/Blue -> White text. Gold/White -> Black text.
                 let textColor = '#000000';
                 if (['#000000', '#EF4444', '#3B82F6'].includes(bgHex)) {
                     textColor = '#FFFFFF';
                 }

                 ctx.shadowBlur = 0;
                 ctx.fillStyle = textColor;
                 ctx.textAlign = 'left';
                 ctx.textBaseline = 'top';
                 ctx.fillText(sigText, rectX + paddingX, rectY + paddingY);
            }

            // Output
            const finalUrl = canvas.toDataURL('image/png');
            updateSlot(index, { resultSrc: finalUrl });
            showStatus('Text embedded successfully!');
        };

        // Check if we need to draw a Logo Image
        if (globalLogoSrc) {
            const logoImg = new Image();
            logoImg.src = globalLogoSrc;
            logoImg.crossOrigin = "anonymous";
            logoImg.onload = () => {
                // Calculate Logo Position: Centered Horizontally, Above the text box
                // Increase Logo Size: was 0.26, increased to 0.32
                const maxLogoW = canvas.width * 0.32; 
                const scale = Math.min(maxLogoW / logoImg.naturalWidth, 1);
                const drawW = logoImg.naturalWidth * scale;
                const drawH = logoImg.naturalHeight * scale;
                
                const logoX = (canvas.width - drawW) / 2;
                // Position just above the black box (boxY) with some margin
                const logoMargin = canvas.height * 0.02; 
                const logoY = boxY - drawH - logoMargin;

                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
                ctx.shadowBlur = 0; // Reset shadow

                drawContent(); // Proceed to draw text box
            };
            logoImg.onerror = () => {
                console.error("Failed to load logo image for canvas");
                drawContent(); // Proceed anyway
            }
        } else {
            drawContent();
        }
    };
}

async function processEmbedAll() {
    showStatus('Starting Batch Embed...');
    for (let i = 0; i < overlaySlots.length; i++) {
        const slot = overlaySlots[i];
        if (slot.file && slot.text) {
            // Process slots that have file and text. 
            // We await each to avoid freezing browser too much if heavy, though canvas is sync-ish.
            // Using a small timeout to allow UI updates between slots if needed.
            await new Promise(r => setTimeout(r, 50)); 
            processSlotEmbed(i);
        }
    }
    showStatus('Batch Embed Completed');
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const paragraphs = text.split('\n');
    let currentY = y;

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let line = '';
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
    });
    return currentY;
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const headLength = 15;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff0000';
    ctx.stroke();
    
    // Head
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(x2, y2);
    ctx.fillStyle = '#ff0000';
    ctx.fill();
}

function redrawCanvas() {
    if (!modalCanvas || !currentEditingFile) return;
    const ctx = modalCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
    
    // Ensure canvas size matches image size
    if (modalImg && (modalCanvas.width !== modalImg.naturalWidth || modalCanvas.height !== modalImg.naturalHeight)) {
         if (modalImg.naturalWidth) {
             modalCanvas.width = modalImg.naturalWidth;
             modalCanvas.height = modalImg.naturalHeight;
         }
    }

    const arrows = fileArrowMap.get(currentEditingFile) || [];
    arrows.forEach(arrow => {
        drawArrow(ctx, arrow.nx1 * modalCanvas.width, arrow.ny1 * modalCanvas.height, arrow.nx2 * modalCanvas.width, arrow.ny2 * modalCanvas.height);
    });
}

function openModal(file: File, src: string) {
    if (!imageModal || !modalImg || !modalCanvas) return;
    currentEditingFile = file;
    modalImg.src = src;
    setHidden(imageModal, false);
    
    // Wait for image to load to set canvas dimensions correctly
    if (modalImg.complete && modalImg.naturalWidth > 0) {
        modalCanvas.width = modalImg.naturalWidth;
        modalCanvas.height = modalImg.naturalHeight;
        redrawCanvas();
    } else {
        modalImg.onload = () => {
            modalCanvas.width = modalImg.naturalWidth;
            modalCanvas.height = modalImg.naturalHeight;
            redrawCanvas();
        };
    }
}

function openZoomModal(src: string) {
    if (!zoomModal || !zoomImg) return;
    zoomImg.src = src;
    setHidden(zoomModal, false);
    zoomScale = 1;
    zoomTranslateX = 0;
    zoomTranslateY = 0;
    zoomImg.style.transform = `translate(0px, 0px) scale(1)`;
}

function handleSignatureFile(file: File) {
    // Check for .txt extension OR text/plain mime type
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if(text) {
                globalSignature = text.trim();
                if(globalSignatureInput) globalSignatureInput.value = globalSignature;
                showStatus('Signature loaded from file');
                renderOverlaySlots(); // Automatically update canvas previews
            }
        };
        reader.readAsText(file);
    } else {
        showStatus('Please upload a valid .txt file', true);
    }
}


// --- Event Listeners ---

if (langToggleBtn) langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'vi' : 'en';
    updateLanguageUI();
});
if (tabAnalysis) tabAnalysis.addEventListener('click', () => { activeTab = 'analysis'; updateLanguageUI(); });
if (tabMultiView) tabMultiView.addEventListener('click', () => { activeTab = 'multiview'; updateLanguageUI(); });
if (tabNotes) tabNotes.addEventListener('click', () => { activeTab = 'notes'; updateLanguageUI(); });
if (tabTextOverlay) tabTextOverlay.addEventListener('click', () => { activeTab = 'textOverlay'; updateLanguageUI(); });

// Global Toolbar Events
if (btnResetOverlay) {
    btnResetOverlay.addEventListener('click', () => {
        initOverlaySlots();
        renderOverlaySlots();
        showStatus('All slots reset.');
    });
}
if (btnAddSlot) {
    btnAddSlot.addEventListener('click', () => {
        overlaySlots.push(createEmptySlot());
        renderOverlaySlots();
        setTimeout(() => overlayGrid?.scrollTo({ top: overlayGrid.scrollHeight, behavior: 'smooth' }), 100);
    });
}
if (btnEmbedAll) {
    btnEmbedAll.addEventListener('click', processEmbedAll);
}
if (btnDownloadAllEmbeds) {
    btnDownloadAllEmbeds.addEventListener('click', async () => {
        const slotsToDownload = overlaySlots.filter(s => s.resultSrc);
        if (slotsToDownload.length === 0) {
            showStatus('No embedded images to download.', true);
            return;
        }
        
        showStatus(`Downloading ${slotsToDownload.length} images...`);
        
        for (let i = 0; i < slotsToDownload.length; i++) {
            const slot = slotsToDownload[i];
            const a = document.createElement('a');
            a.href = slot.resultSrc!;
            // Auto name logic: Overlay_OriginalName.png
            // Fallback to index if no original name
            const originalBase = slot.originalName ? slot.originalName.replace(/\.[^/.]+$/, "") : `Result_${i + 1}`;
            a.download = `Overlay_${originalBase}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Small delay to prevent browser blocking simultaneous downloads
            await new Promise(r => setTimeout(r, 200));
        }
    });
}
if (globalFontSelect) {
    globalFontSelect.addEventListener('change', (e) => {
        globalFont = (e.target as HTMLSelectElement).value;
        renderOverlaySlots();
    });
}
if (globalSignatureInput) {
    globalSignatureInput.addEventListener('input', (e) => {
        globalSignature = (e.target as HTMLInputElement).value;
        renderOverlaySlots();
    });
}

// Global Actions Listeners
if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
        // Expand All now works for any visible collapsible cards in the current tab
        const visibleContainer = document.querySelector('section.flex-1');
        if (visibleContainer) {
            visibleContainer.querySelectorAll('.collapsible-card').forEach(c => c.classList.remove('card-collapsed'));
        }
    });
}
if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
        // Collapse All now works for any visible collapsible cards in the current tab
        const visibleContainer = document.querySelector('section.flex-1');
        if (visibleContainer) {
            visibleContainer.querySelectorAll('.collapsible-card').forEach(c => c.classList.add('card-collapsed'));
        }
    });
}
if (btnClearResults) {
    btnClearResults.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear ALL results?")) {
            // 1. Reset all data
            lastAnalysisData = null;
            customAnglesHistory = [];
            notesHistory = [];
            
            // 2. Reset Overlay
            initOverlaySlots(); 
            
            // 3. Force Clear DOM Containers (Important fix)
            if (multiviewResults) multiviewResults.innerHTML = '';
            if (notesResults) notesResults.innerHTML = '';
            
            // 4. Reset Static Text Fields
            const emptyTxt = "Waiting for analysis...";
            if(getEl('res-prompt')) setText(getEl('res-prompt'), emptyTxt);
            if(getEl('res-sketch-prompt')) setText(getEl('res-sketch-prompt'), emptyTxt);
            if(getEl('res-style')) setText(getEl('res-style'), emptyTxt);
            if(getEl('res-material')) setText(getEl('res-material'), emptyTxt);
            if(getEl('res-lighting')) setText(getEl('res-lighting'), emptyTxt);
            if(getEl('res-context')) setText(getEl('res-context'), emptyTxt);
            if(getEl('res-composition')) setText(getEl('res-composition'), emptyTxt);
            if(getEl('obj-analysis-result')) setText(getEl('obj-analysis-result'), "");
            
            // 5. Re-render UI to reflect empty state immediately
            updateLanguageUI();
            renderOverlaySlots(); // Ensure grid is redrawn empty
            renderMultiViewResults(); // Ensure empty
            renderNotesResults(); // Ensure empty
            
            showStatus("All results cleared.");
        }
    });
}

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Alt + N: Add New Slot
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (activeTab === 'textOverlay') {
            btnAddSlot?.click();
        }
    }
    
    // Alt + R: Reset All Slots
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (activeTab === 'textOverlay') {
            btnResetOverlay?.click();
        }
    }

    // Alt + Enter: Embed All
    if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        if (activeTab === 'textOverlay') {
            processEmbedAll();
        }
    }

    // Ctrl + Enter: Embed currently focused slot
    if (e.ctrlKey && e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === 'TEXTAREA' && activeEl.classList.contains('overlay-textarea')) {
            e.preventDefault();
            const idxStr = activeEl.getAttribute('data-slot-index');
            if (idxStr !== null) {
                const idx = parseInt(idxStr);
                processSlotEmbed(idx);
            }
        }
    }
});

// Signature Upload Logic
if (btnUploadSig && signatureFileInput) {
    btnUploadSig.addEventListener('click', () => signatureFileInput.click());
    signatureFileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) handleSignatureFile(file);
    });
}

if (globalSignatureInput) {
    const wrapper = globalSignatureInput.parentElement;
    if (wrapper) {
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(signatureDropIndicator) signatureDropIndicator.classList.remove('hidden');
        });
        wrapper.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(signatureDropIndicator) signatureDropIndicator.classList.add('hidden');
        });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(signatureDropIndicator) signatureDropIndicator.classList.add('hidden');
            const file = e.dataTransfer?.files[0];
            if (file) handleSignatureFile(file);
        });
    }
}

// Add Signature Color Picker Listeners
const sigColorBtns = document.querySelectorAll('.sig-color-btn');
sigColorBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const color = target.getAttribute('data-color');
        if (color) {
            globalSigBgColor = color;
            // Update UI active state
            sigColorBtns.forEach(b => b.classList.remove('active', 'ring-2', 'ring-offset-1', 'ring-offset-[#18181a]', 'ring-blue-500'));
            target.classList.add('active', 'ring-2', 'ring-offset-1', 'ring-offset-[#18181a]', 'ring-blue-500');
            showStatus(`Signature background: ${color}`);
            renderOverlaySlots(); 
        }
    });
});

// Logo Handling
if (logoDropZone && logoFileInput) {
    logoDropZone.addEventListener('click', (e) => {
        if((e.target as HTMLElement).tagName !== 'BUTTON') logoFileInput.click();
    });
    logoFileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                globalLogoSrc = ev.target?.result as string;
                if(logoPreview) {
                    logoPreview.src = globalLogoSrc;
                    logoPreview.classList.remove('hidden');
                }
                if(logoEmpty) logoEmpty.classList.add('hidden');
                if(btnClearLogo) btnClearLogo.classList.remove('hidden');
                showStatus('Logo loaded');
                renderOverlaySlots();
            };
            reader.readAsDataURL(file);
        }
    });

    // Logo Drag & Drop
    logoDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDropZone.classList.add('border-blue-500', 'bg-gray-800');
    });
    logoDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDropZone.classList.remove('border-blue-500', 'bg-gray-800');
    });
    logoDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDropZone.classList.remove('border-blue-500', 'bg-gray-800');
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('image/')) {
             const reader = new FileReader();
            reader.onload = (ev) => {
                globalLogoSrc = ev.target?.result as string;
                if(logoPreview) {
                    logoPreview.src = globalLogoSrc;
                    logoPreview.classList.remove('hidden');
                }
                if(logoEmpty) logoEmpty.classList.add('hidden');
                if(btnClearLogo) btnClearLogo.classList.remove('hidden');
                showStatus('Logo loaded via drop');
                renderOverlaySlots();
            };
            reader.readAsDataURL(file);
        }
    });
}

if (btnClearLogo) {
    btnClearLogo.addEventListener('click', (e) => {
        e.stopPropagation();
        globalLogoSrc = null;
        if(logoPreview) {
            logoPreview.src = '';
            logoPreview.classList.add('hidden');
        }
        if(logoEmpty) logoEmpty.classList.remove('hidden');
        if(btnClearLogo) btnClearLogo.classList.add('hidden');
        if(logoFileInput) logoFileInput.value = '';
        showStatus('Logo removed');
        renderOverlaySlots();
    });
}

// File Handling (Analysis Mode)
function renderPreview(files: File[]) {
    if(!previewContainer || !emptyState) return;
    previewContainer.innerHTML = '';
    files.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = "relative group w-20 h-20 rounded overflow-hidden border border-gray-600 shrink-0";
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = "w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity";
        img.onclick = () => openModal(file, img.src);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = "absolute top-1 right-1 w-4 h-4 bg-gray-900/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10";
        removeBtn.innerHTML = iconRemove;
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            currentFiles.splice(index, 1);
            fileArrowMap.delete(file);
            renderPreview(currentFiles);
        };
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        previewContainer.appendChild(wrapper);
    });

    if(files.length > 0) {
        removeClass(previewContainer, 'hidden');
        addClass(emptyState, 'hidden');
        if(clearBtn) removeClass(clearBtn, 'hidden');
    } else {
        addClass(previewContainer, 'hidden');
        removeClass(emptyState, 'hidden');
        if(clearBtn) addClass(clearBtn, 'hidden');
    }
}

function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    currentFiles = [...currentFiles, ...newFiles].slice(0, 10);
    renderPreview(currentFiles);
}

// Paste Event Listener
document.addEventListener('paste', async (e) => {
    // Only handle paste if we have access to clipboard data
    if (!e.clipboardData) return;
    
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
                // If in Text Overlay mode, handle differently
                if (activeTab === 'textOverlay') {
                    // Find first empty slot or add new
                    const emptyIndex = overlaySlots.findIndex(s => !s.file);
                    const file = new File([blob], "pasted_image.png", { type: "image/png" });
                    
                    if (emptyIndex !== -1) {
                        await handleSlotFile(emptyIndex, file);
                    } else {
                        // Add new slot
                        overlaySlots.push(createEmptySlot());
                        await handleSlotFile(overlaySlots.length - 1, file);
                        renderOverlaySlots();
                    }
                    
                    showStatus('Pasted image into Text Overlay');
                    return; 
                }

                // Normal Analysis flow
                const hasMetadata = await processBlobForMetadata(blob);
                pastedFiles.push(blob);
                if (hasMetadata) showStatus('Data loaded from pasted image!');
            }
        }
    }

    if (pastedFiles.length > 0 && activeTab !== 'textOverlay') {
        e.preventDefault(); 
        currentFiles = [...currentFiles, ...pastedFiles].slice(0, 10);
        renderPreview(currentFiles);
    }
});

if(dropZone) {
    dropZone.addEventListener('click', (e) => { if((e.target as HTMLElement).tagName !== 'BUTTON') fileInput?.click(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); addClass(dropZone, 'drag-active'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); removeClass(dropZone, 'drag-active'); });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); removeClass(dropZone, 'drag-active'); handleFiles(e.dataTransfer?.files || null); });
}
if(fileInput) fileInput.addEventListener('change', (e) => handleFiles((e.target as HTMLInputElement).files));
if(clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); currentFiles = []; renderPreview([]); });

// Sketch Handling
function handleSketch(file: File) {
    if(!file.type.startsWith('image/')) return;
    currentSketchFile = file;
    if(sketchPreviewImg) { sketchPreviewImg.src = URL.createObjectURL(file); removeClass(sketchPreviewImg, 'hidden'); }
    if(sketchEmptyState) addClass(sketchEmptyState, 'hidden');
    if(sketchClearBtn) removeClass(sketchClearBtn, 'hidden');
}

if(sketchDropZone) {
    sketchDropZone.addEventListener('click', (e) => { if((e.target as HTMLElement).tagName !== 'BUTTON') sketchInput?.click(); });
    sketchDropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); addClass(sketchDropZone, 'drag-active'); });
    sketchDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); removeClass(sketchDropZone, 'drag-active'); });
    sketchDropZone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); removeClass(sketchDropZone, 'drag-active'); if(e.dataTransfer?.files[0]) handleSketch(e.dataTransfer.files[0]); });
}
if(sketchInput) sketchInput.addEventListener('change', (e) => { if((e.target as HTMLInputElement).files?.[0]) handleSketch((e.target as HTMLInputElement).files![0]); });


// --- Custom Zoom Modal Logic ---
function updateZoomTransform() {
    if(zoomImg) {
        zoomImg.style.transform = `translate(${zoomTranslateX}px, ${zoomTranslateY}px) scale(${zoomScale})`;
    }
}

function closeZoomModal() {
    if(zoomModal) addClass(zoomModal, 'hidden');
}

if(zoomCloseBtn) zoomCloseBtn.addEventListener('click', closeZoomModal);
if(zoomDlBtn) zoomDlBtn.addEventListener('click', () => {
    if(zoomImg && zoomImg.src) {
        const a = document.createElement('a');
        a.href = zoomImg.src;
        a.download = 'Architectural_Overlay.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});

// Zoom Mouse Interactions
if(zoomPanContainer) {
    // Scroll to Zoom (Middle Mouse Wheel)
    zoomPanContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001; // Scale factor
        const newScale = Math.min(Math.max(0.1, zoomScale + delta), 10);
        zoomScale = newScale;
        updateZoomTransform();
    });

    // Drag to Pan
    zoomPanContainer.addEventListener('mousedown', (e) => {
        isPanning = true;
        panStartX = e.clientX - zoomTranslateX;
        panStartY = e.clientY - zoomTranslateY;
        zoomPanContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if(!isPanning) return;
        e.preventDefault();
        zoomTranslateX = e.clientX - panStartX;
        zoomTranslateY = e.clientY - panStartY;
        updateZoomTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        if(zoomPanContainer) zoomPanContainer.style.cursor = 'move';
    });
}

// ESC to Close
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        if(!zoomModal?.classList.contains('hidden')) closeZoomModal();
        else if(!imageModal?.classList.contains('hidden')) closeModal();
    }
});


// Canvas Logic (Existing Arrows)
function closeModal() { if(imageModal) addClass(imageModal, 'hidden'); isDrawing = false; currentEditingFile = null; }
if(btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if(btnClearDraw) btnClearDraw.addEventListener('click', () => { arrowHistory = []; if(currentEditingFile) fileArrowMap.set(currentEditingFile, []); redrawCanvas(); });

if(modalCanvas) {
    modalCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true; const rect = modalCanvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) * (modalCanvas.width / rect.width);
        startY = (e.clientY - rect.top) * (modalCanvas.height / rect.height);
    });
    modalCanvas.addEventListener('mousemove', (e) => {
        if(!isDrawing) return; redrawCanvas(); const ctx = modalCanvas.getContext('2d');
        const rect = modalCanvas.getBoundingClientRect();
        const currX = (e.clientX - rect.left) * (modalCanvas.width / rect.width);
        const currY = (e.clientY - rect.top) * (modalCanvas.height / rect.height);
        if(ctx) { ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(currX, currY); ctx.strokeStyle='#ff0000'; ctx.stroke(); }
    });
    modalCanvas.addEventListener('mouseup', (e) => {
        if(!isDrawing) return; isDrawing = false;
        const rect = modalCanvas.getBoundingClientRect();
        const endX = (e.clientX - rect.left) * (modalCanvas.width / rect.width);
        const endY = (e.clientY - rect.top) * (modalCanvas.height / rect.height);
        if (Math.abs(endX - startX) > 5) {
             arrowHistory.push({ nx1: startX/modalCanvas.width, ny1: startY/modalCanvas.height, nx2: endX/modalCanvas.width, ny2: endY/modalCanvas.height });
             if(currentEditingFile) fileArrowMap.set(currentEditingFile, [...arrowHistory]);
        }
        redrawCanvas();
    });
}

// --- Analysis Handlers ---

if(analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0 && !currentSketchFile) { showStatus('Please upload files.', true); return; }
        setLoading(true);
        try {
            const hasSketch = !!currentSketchFile;
            let prompt = `Role: Architectural Photographer & Prompt Engineer. Analyze images. Return JSON.`;
            if (hasSketch) prompt += ` Create 'sketchPrompt' to render the sketch based on references.`;
            prompt += ` JSON: { "style": {"en":"", "vi":""}, "materials": {"en":"", "vi":""}, "lighting": {"en":"", "vi":""}, "context": {"en":"", "vi":""}, "composition": {"en":"", "vi":""}, "generationPrompt": {"en":"", "vi":""} ${hasSketch ? ', "sketchPrompt": {"en":"", "vi":""}':''} }`;
            
            const txt = await callGemini(prompt, currentFiles);
            lastAnalysisData = JSON.parse(txt);
            updateLanguageUI(); showStatus('');
        } catch(e) { handleApiError(e, 'Error analyzing'); } finally { setLoading(false); }
    });
}

// Detailed Object Analysis (New Handler)
if(btnRunObjAnalysis) {
    btnRunObjAnalysis.addEventListener('click', async () => {
        if (currentFiles.length === 0) {
            showStatus(currentLang === 'en' ? 'Please upload images first.' : 'Vui lòng tải ảnh lên trước.', true);
            return;
        }

        try {
            setLoading(true);
            if(objAnalysisResult) {
                setHidden(objAnalysisResult, false);
                setText(objAnalysisResult, currentLang === 'en' ? "Analyzing DNA..." : "Đang phân tích DNA...");
            }

            const langInstruction = currentLang === 'vi' ? 'VIETNAMESE' : 'ENGLISH';
            const prompt = `
                Role: Senior Architectural Technical Analyst.
                Task: Analyze the provided images to extract the "Visual DNA" of the object/building.
                Focus on:
                1. Architectural Style & Form.
                2. Material Palette & Textures.
                3. Key Distinctive Features (Windows, Roof, Ornamentation).
                4. Color Consistency.

                Goal: Create a reference description that ensures future generated angles look exactly like this object.

                Output strictly valid JSON:
                {
                    "analysis": "Full detailed technical description in ${langInstruction}..."
                }
            `;

            const responseText = await callGemini(prompt, currentFiles);
            const data = JSON.parse(responseText);

            if(objAnalysisResult) {
                setText(objAnalysisResult, data.analysis || "No result.");
            }
            showStatus('');

        } catch (e) {
            handleApiError(e, 'Analysis Error');
            if(objAnalysisResult) setText(objAnalysisResult, "Error.");
        } finally {
            setLoading(false);
        }
    });
}

// --- Note Analysis Handler (New) ---
if (analyzeNotesBtn) {
    analyzeNotesBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0) {
            showStatus(currentLang === 'en' ? 'Please upload images.' : 'Vui lòng tải ảnh lên.', true);
            return;
        }
        setLoading(true);
        notesHistory = [];
        
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) { await openApiKeyDialog(); setLoading(false); return; }
            const ai = new GoogleGenAI({ apiKey });

            // Process images concurrently
            const promises = currentFiles.map(async (file) => {
                const parts = [
                    await fileToGenerativePart(file),
                    { text: "Analyze the handwritten or printed notes/text on this image. Transcribe strictly into Vietnamese (if it's not already VI, translate it to VI). Also provide an English translation. Return only JSON: { \"vi\": \"...\", \"en\": \"...\" }" }
                ];
                
                try {
                    // Use retry wrapper
                    const response = await generateContentWithRetry(ai, {
                        model: 'gemini-3-flash-preview',
                        contents: { parts: parts },
                        config: { responseMimeType: "application/json" }
                    });
                    const txt = response.text || "{}";
                    const json = JSON.parse(txt);
                    return { file: file, vi: json.vi || "No text detected", en: json.en || "No text detected" };
                } catch (e) {
                    console.error("Single image error:", e);
                    return { file: file, vi: "Error processing", en: "Error processing" };
                }
            });

            notesHistory = await Promise.all(promises);
            updateLanguageUI();
            showStatus('Notes Extracted!');

        } catch (e) {
            handleApiError(e, 'Error in batch processing');
        } finally {
            setLoading(false);
        }
    });
}


// Multi-View Generator
if(multiViewBtn) {
    multiViewBtn.addEventListener('click', async () => {
         if (currentFiles.length === 0) { showStatus('Please upload references.', true); return; }
         setLoading(true);
         try {
             const count = angleInput ? angleInput.value : "4";
             const prompt = `Generate ${count} distinct camera angle prompts for this project.
             Output JSON: { "multiViewPrompts": { "en": [{ "angle": "Title", "content": "...", "composition": "...", "lighting": "..." }], "vi": [...] } }`;
             
             const txt = await callGemini(prompt, currentFiles);
             const raw = JSON.parse(txt);
             const fmt = (arr: any[]) => arr.map(i => `===ANGLE: ${i.angle}===\n[CONTENT]: ${i.content}\n[COMPOSITION]: ${i.composition}\n[LIGHTING]: ${i.lighting}`).join('\n\n');
             
             if(!lastAnalysisData) lastAnalysisData = {};
             lastAnalysisData.multiViewPrompts = { en: fmt(raw.multiViewPrompts.en), vi: fmt(raw.multiViewPrompts.vi) };
             updateLanguageUI(); showStatus('');
         } catch(e) { handleApiError(e, 'Error generating views'); } finally { setLoading(false); }
    });
}

// Custom Angle Generator
if(btnCustomAngle) {
    btnCustomAngle.addEventListener('click', async () => {
        const req = customAngleInput?.value.trim();
        if(!req || currentFiles.length === 0) return;
        setLoading(true);
        try {
            const prompt = `Generate 1 detailed prompt for angle: "${req}". Follow annotations if any.
            Output JSON: { "en": { "title": "...", "content": "...", "composition": "...", "lighting": "..." }, "vi": { ... } }`;
            const txt = await callGemini(prompt, currentFiles);
            const raw = JSON.parse(txt);
            customAnglesHistory.push({ en: raw.en, vi: raw.vi });
            updateLanguageUI(); showStatus('Generated!');
            if(customAngleInput) customAngleInput.value = '';
        } catch(e) { handleApiError(e, 'Error generating angle'); } finally { setLoading(false); }
    });
}

// Single Run Buttons (Reset/Re-run)
const runSingle = async (key: keyof AnalysisResult) => {
    if(currentFiles.length === 0 && !currentSketchFile) return;
    setLoading(true);
    try {
        const prompt = `Analyze ONLY: ${String(key)}. Return JSON: { "${String(key)}": { "en": "...", "vi": "..." } }`;
        const txt = await callGemini(prompt, currentFiles);
        const raw = JSON.parse(txt);
        if(!lastAnalysisData) lastAnalysisData = {};
        lastAnalysisData[key] = raw[key];
        updateLanguageUI();
    } catch(e) { handleApiError(e, 'Error'); } finally { setLoading(false); }
};
if(btnRunStyle) btnRunStyle.addEventListener('click', (e) => { e.stopPropagation(); runSingle('style'); });
if(btnRunMaterial) btnRunMaterial.addEventListener('click', (e) => { e.stopPropagation(); runSingle('materials'); });
if(btnRunLighting) btnRunLighting.addEventListener('click', (e) => { e.stopPropagation(); runSingle('lighting'); });
if(btnRunContext) btnRunContext.addEventListener('click', (e) => { e.stopPropagation(); runSingle('context'); });
if(btnRunComposition) btnRunComposition.addEventListener('click', (e) => { e.stopPropagation(); runSingle('composition'); });
if(btnRunPrompt) btnRunPrompt.addEventListener('click', (e) => { e.stopPropagation(); runSingle('generationPrompt'); });
if(btnRunSketchPrompt) btnRunSketchPrompt.addEventListener('click', (e) => { e.stopPropagation(); runSingle('sketchPrompt'); });

// --- Helper for Single Card Actions (Copy/Download) ---
function setupCardActions(
    resId: string, 
    copyBtnId: string, 
    dlBtnId: string, 
    filename: string
) {
    const resEl = getEl(resId);
    const copyBtn = getEl(copyBtnId);
    const dlBtn = getEl(dlBtnId);

    if (copyBtn && resEl) {
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const text = resEl.textContent;
            if (text && text !== "Waiting for analysis...") {
                try {
                    await navigator.clipboard.writeText(text);
                    showStatus('Copied to clipboard!');
                    setTimeout(() => showStatus(''), 2000);
                } catch (err) {
                    showStatus('Failed to copy', true);
                }
            } else {
                showStatus('Nothing to copy', true);
            }
        });
    }

    if (dlBtn && resEl) {
        dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = resEl.textContent;
             if (text && text !== "Waiting for analysis...") {
                triggerDownload(text, `${filename}.txt`);
            } else {
                showStatus('Nothing to download', true);
            }
        });
    }
}

// Setup listeners for Copy and Download buttons
setupCardActions('res-style', 'btn-copy-style', 'btn-dl-style', 'Style_Analysis');
setupCardActions('res-material', 'btn-copy-material', 'btn-dl-material', 'Material_Analysis');
setupCardActions('res-lighting', 'btn-copy-lighting', 'btn-dl-lighting', 'Lighting_Analysis');
setupCardActions('res-context', 'btn-copy-context', 'btn-dl-context', 'Context_Analysis');
setupCardActions('res-composition', 'btn-copy-composition', 'btn-dl-composition', 'Composition_Analysis');
setupCardActions('res-prompt', 'btn-copy-prompt', 'btn-dl-prompt', 'Generation_Prompt');
setupCardActions('res-sketch-prompt', 'btn-copy-sketch-prompt', 'btn-dl-sketch-prompt', 'Sketch_Prompt');

// PNG Info Button Logic
if (btnPngInfoPrompt) {
    btnPngInfoPrompt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!resPrompt || !resPrompt.textContent || resPrompt.textContent === "Waiting for analysis...") {
            showStatus('No prompt data to embed.', true);
            return;
        }
        if (currentFiles.length === 0) {
            showStatus('No original image found.', true);
            return;
        }
        const getEnText = (el: HTMLElement | null, key?: keyof AnalysisResult) => {
            if (lastAnalysisData && key && lastAnalysisData[key]?.en) return lastAnalysisData[key].en;
            const t = el?.textContent || "";
            return (t === "Waiting for analysis...") ? "" : t;
        };

        const bananaData = {
            mega: getEnText(resPrompt, 'generationPrompt'),
            lighting: getEnText(resLighting, 'lighting'),
            scene: getEnText(resContext, 'context'),
            view: getEnText(resComposition, 'composition'),
            inpaint: "",
            inpaintEnabled: false,
            cameraProjection: false
        };

        const carrierFile = currentFiles[0];
        const img = new Image();
        img.src = URL.createObjectURL(carrierFile);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const buffer = await blob.arrayBuffer();
                        const uint8View = new Uint8Array(buffer);
                        const finalPngBuffer = writePngMetadata(uint8View, "BananaProData", JSON.stringify(bananaData));
                        const finalBlob = new Blob([finalPngBuffer], { type: "image/png" });
                        const url = URL.createObjectURL(finalBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `BananaPro_Info_${carrierFile.name.split('.')[0]}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showStatus('Downloaded PNG for Banana Pro!');
                        setTimeout(() => showStatus(''), 2000);
                    }
                }, "image/png");
            }
        };
        img.onerror = () => {
            showStatus('Error processing image.', true);
        };
    });
}

// Send to Banana Pro Button Logic (Correct Format)
if (btnSendBanana) {
    btnSendBanana.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!resPrompt || !resPrompt.textContent || resPrompt.textContent === "Waiting for analysis...") {
            showStatus('No prompt data to copy.', true);
            return;
        }
        const getEnText = (el: HTMLElement | null, key?: keyof AnalysisResult) => {
            if (lastAnalysisData && key && lastAnalysisData[key]?.en) return lastAnalysisData[key].en;
            const t = el?.textContent || "";
            return (t === "Waiting for analysis...") ? "" : t;
        };
        const bananaData = {
            mega: getEnText(resPrompt, 'generationPrompt'),
            lighting: getEnText(resLighting, 'lighting'),
            scene: getEnText(resContext, 'context'),
            view: getEnText(resComposition, 'composition'),
            inpaint: "",
            inpaintEnabled: false,
            cameraProjection: false
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(bananaData, null, 2));
            showStatus('Copied Data JSON!');
        } catch (err) {
            console.error("Failed to copy:", err);
            showStatus('Failed to copy.', true);
        }
        setTimeout(() => showStatus(''), 2000);
    });
}

// Download All Button
if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', () => {
        if (!lastAnalysisData) {
            showStatus('No analysis data to download', true);
            return;
        }
        
        const t = translations[currentLang];
        let content = `${t.appTitle} - Full Analysis\n\n`;
        
        if (lastAnalysisData.style?.[currentLang]) content += `=== ${t.titles.style} ===\n${lastAnalysisData.style[currentLang]}\n\n`;
        if (lastAnalysisData.materials?.[currentLang]) content += `=== ${t.titles.materials} ===\n${lastAnalysisData.materials[currentLang]}\n\n`;
        if (lastAnalysisData.lighting?.[currentLang]) content += `=== ${t.titles.lighting} ===\n${lastAnalysisData.lighting[currentLang]}\n\n`;
        if (lastAnalysisData.context?.[currentLang]) content += `=== ${t.titles.context} ===\n${lastAnalysisData.context[currentLang]}\n\n`;
        if (lastAnalysisData.composition?.[currentLang]) content += `=== ${t.titles.composition} ===\n${lastAnalysisData.composition[currentLang]}\n\n`;
        if (lastAnalysisData.generationPrompt?.[currentLang]) content += `=== ${t.titles.generationPrompt} ===\n${lastAnalysisData.generationPrompt[currentLang]}\n\n`;
        if (lastAnalysisData.sketchPrompt?.[currentLang]) content += `=== ${t.titles.sketchPrompt} ===\n${lastAnalysisData.sketchPrompt[currentLang]}\n\n`;

        triggerDownload(content, 'Full_Architectural_Analysis.txt');
    });
}

// "Paste Banana" -> Copy Data PNG info (from clipboard image OR text)
if (btnPasteBanana) {
    btnPasteBanana.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        try {
            const clipboardItems = await navigator.clipboard.read();
            let processed = false;

            for (const item of clipboardItems) {
                if (item.types.includes('image/png')) {
                    const blob = await item.getType('image/png');
                    
                    // If Text Overlay Mode
                    if (activeTab === 'textOverlay') {
                         const file = new File([blob], "pasted_image.png", { type: "image/png" });
                         // Handle Paste for Grid - find empty or add new
                         const emptyIndex = overlaySlots.findIndex(s => !s.file);
                         if (emptyIndex !== -1) {
                             await handleSlotFile(emptyIndex, file);
                         } else {
                             overlaySlots.push(createEmptySlot());
                             await handleSlotFile(overlaySlots.length - 1, file);
                             renderOverlaySlots();
                         }
                         
                         showStatus('Loaded pasted image into Text Overlay');
                         processed = true;
                         break;
                    }

                    if (await processBlobForMetadata(blob)) {
                        processed = true;
                        break;
                    }
                }
            }

            if (!processed) {
                 for (const item of clipboardItems) {
                    if (item.types.includes('text/plain')) {
                        const blob = await item.getType('text/plain');
                        const text = await blob.text();
                        try {
                            const data = JSON.parse(text);
                            if (data.mega || data.lighting || data.scene || data.view) {
                                populateBananaData(data);
                                showStatus('Data loaded from clipboard text!');
                                processed = true;
                                break;
                            }
                        } catch (e) { /* Not JSON */ }
                    }
                }
            }

            if (!processed) {
                 try {
                    const text = await navigator.clipboard.readText();
                    const data = JSON.parse(text);
                    if (data.mega || data.lighting || data.scene || data.view) {
                        populateBananaData(data);
                        showStatus('Data loaded from clipboard text!');
                        processed = true;
                    }
                 } catch (e) { /* Not JSON */ }
            }

            if (!processed) {
                showStatus('No Banana Data (Image/JSON) found.', true);
            }

        } catch (err) {
            console.error(err);
            alert("Clipboard access denied. Please press Ctrl+V to paste.");
            showStatus('Clipboard blocked. Press Ctrl+V.', true);
        }
    });
}

// Init Setup Call
setupCollapsibleCards();
updateLanguageUI();