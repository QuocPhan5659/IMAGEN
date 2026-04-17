import JSZip from 'jszip';

let customApiKey: string | null = localStorage.getItem('gemini_custom_api_key');

// --- Text Overlay State (Grid) ---
interface OverlaySlot {
    id: string;
    file: File | null;
    imgSrc: string | null;
    text: string;
    isDarkText: boolean;
    hasBackground: boolean;
    resultSrc: string | null;
    isTranslating: boolean;
    originalName: string | null;
    isCollapsed: boolean;
}

let overlaySlots: OverlaySlot[] = [];
let globalFont = 'Inter';
let globalSignature = '';
let globalLogoSrc: string | null = null;
let globalLogoSize = 100;
let globalLogoOpacity = 100;
let globalLogoPosition = 'bottom';
let globalSigBgColor = '#00ff00'; // Default Neon Green

// --- Application State ---
type Lang = 'en' | 'vi';
let currentLang: Lang = 'en';
let activeTab: 'analysis' | 'notes' | 'textOverlay' | 'artistic' | 'removeLogo' | 'multiView' = 'analysis';

// --- Logo Removal State ---
interface LogoRemovalSlot {
    id: string;
    file: File | null;
    imgSrc: string | null;
    resultSrc: string | null;
    isProcessing: boolean;
}
let logoRemovalSlots: LogoRemovalSlot[] = [];
let currentSketchFile: File | null = null;
let currentStyleRefFile: File | null = null;
let currentFiles: File[] = [];
let currentModel = localStorage.getItem('gemini_selected_model') || (customApiKey ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview');

interface AnalysisResult {
    style?: { en: string; vi: string };
    materials?: { en: string; vi: string };
    lighting?: { en: string; vi: string };
    context?: { en: string; vi: string };
    composition?: { en: string; vi: string };
    generationPrompt?: { en: string; vi: string };
    sketchPrompt?: { en: string; vi: string };
    photoToSketchPrompt?: { en: string; vi: string };
    artisticPrompts?: { [key: string]: { en: string; vi: string } };
    multiViewPrompts?: { en: string; vi: string };
    collageAnalysis?: { en: string; vi: string };
    [key: string]: any;
}
let lastAnalysisData: AnalysisResult | null = null;
let downloadDirectoryHandle: any = null;

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
let artisticHistory: { style: string; en: string; vi: string }[] = [];

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

// API Key Modal
const btnSettings = getEl<HTMLButtonElement>('btn-settings');
const btnProBadge = getEl<HTMLButtonElement>('btn-pro-badge');
const apiKeyModal = getEl<HTMLDivElement>('api-key-modal');
const apiKeyInput = getEl<HTMLInputElement>('api-key-input');
const btnCloseApiModal = getEl<HTMLButtonElement>('btn-close-api-modal');
const btnSaveApiKey = getEl<HTMLButtonElement>('btn-save-api-key');
const btnRemoveApiKey = getEl<HTMLButtonElement>('btn-remove-api-key');
const modelSelect = getEl<HTMLSelectElement>('model-select');

// --- Helper Functions ---
// Helper: Extract JSON from markdown or raw text
function extractJson(text: string): any {
    const tryParse = (s: string) => {
        try {
            return JSON.parse(s);
        } catch (e) {
            try {
                // Attempt to clean common LLM JSON errors:
                // 1. Remove trailing commas
                // 2. Escape literal newlines in strings
                const cleaned = s
                    .trim()
                    .replace(/,\s*([\]}])/g, '$1')
                    .replace(/"((?:\\.|[^"\\])*)"/g, (match, p1) => {
                        return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
                    });
                return JSON.parse(cleaned);
            } catch (e2) {
                return null;
            }
        }
    };

    // 1. Try direct parse first
    let result = tryParse(text);
    if (result) return result;

    // 2. Try to find JSON block in markdown
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        result = tryParse(match[1]);
        if (result) return result;
    }
    
    // 3. Try to find anything between the first { and the last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        result = tryParse(text.substring(firstBrace, lastBrace + 1));
        if (result) return result;
    }
    
    console.error("Critical JSON Parse Failure. Raw Content:", text);
    throw new Error("Could not parse JSON from model response. Please check the model output or retry.");
}

async function copyToClipboard(text: string, btnEl?: HTMLElement, successIcon?: string, originalIcon?: string): Promise<boolean> {
    if (!text) return false;
    let successful = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            successful = true;
        }
    } catch (err) {
        console.error("Clipboard API failed, trying fallback:", err);
    }

    if (!successful) {
        // Fallback for non-secure contexts or failed API
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            successful = document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (err) {
            console.error("Fallback copy failed:", err);
        }
    }

    if (successful && btnEl && successIcon && originalIcon) {
        btnEl.innerHTML = successIcon;
        setTimeout(() => { btnEl.innerHTML = originalIcon; }, 2000);
    }

    return successful;
}

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
        btnAnalyzeImagePrompt: "IMAGE PROMPT",
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
        tabNotes: "Notes",
        tabTextOverlay: "Text Overlay",
        tabArtistic: "Artistic Styles",
        tabRemoveLogo: "Remove Logo",
        lblRemoveLogoTitle: "Gemini Logo Removal",
        lblRemoveLogoDesc: "Clean your images by removing the Gemini star logo while preserving all architectural details.",
        lblLogoDragDrop: "Drag & Drop images here or click to upload",
        btnLogoGenAll: "Gen All (REMOVE LOGO)",
        btnLogoDownloadAll: "Download All",
        btnLogoResetAll: "Reset All",
        btnToSketch: "Photo to Sketch",
        titlePhotoToSketch: "Photo to Sketch Prompt",
        lblArtistic: "Artistic Style Transfer",
        lblArtisticDesc: "Generate prompts to convert your images into various artistic sketching styles.",
        lblCustomStyle: "Custom Style Reference",
        lblUploadStyle: "Upload Style Reference",
        lblCustomInstruction: "Custom Instruction",
        btnGenerateCustom: "Generate Style",
        artisticStyles: {
            watercolor: "Watercolor",
            blueInk: "Blue Ink Sketch",
            cleanLine: "Clean Line Art",
            blackInk: "Black Ink Technical",
            redInk: "Red Ink Sketch"
        },
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
            multiViewPrompts: "Multi-View Prompts",
            collageAnalysis: "Project Detailed Analysis (DNA)"
        },
        apiModal: {
            title: "ENCRYPTION KEY",
            desc: "Provide authorization key for Pro-v3.1 access. Default protocol utilizes Flash-v3.",
            placeholder: "[KEY_INPUT]",
            btnCancel: "CANCEL",
            btnSave: "AUTHORIZE",
            btnRemove: "REVOKE ACCESS",
            link: "Request Key"
        },
        modelSwitched: "Model switched to "
    },
    vi: {
        appTitle: "Trợ Lý Kiến Trúc AI",
        appSubtitle: "Phân tích sâu hỗ trợ bởi Gemini Vision",
        uploadTitle: "Tải Ảnh Lên",
        uploadDrag: "Kéo thả, Nhấn hoặc Dán (Ctrl+V)",
        uploadSketch: "Tải Phác Thảo (Tùy chọn)",
        btnAnalyze: "Phân Tích Ảnh",
        btnAnalyzeImagePrompt: "IMAGE PROMPT",
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
        tabNotes: "Ghi Chú",
        tabTextOverlay: "Chèn Chữ",
        tabArtistic: "Phong Cách Nghệ Thuật",
        tabRemoveLogo: "Xóa Logo",
        lblRemoveLogoTitle: "Xóa Logo Gemini",
        lblRemoveLogoDesc: "Làm sạch hình ảnh bằng cách xóa logo ngôi sao Gemini trong khi vẫn giữ nguyên các chi tiết kiến trúc.",
        lblLogoDragDrop: "Kéo & Thả ảnh vào đây hoặc click để tải lên",
        btnLogoGenAll: "Chạy Tất Cả",
        btnLogoDownloadAll: "Tải Tất Cả",
        btnLogoResetAll: "Đặt Lại Tất Cả",
        btnToSketch: "Ảnh sang Sketch",
        titlePhotoToSketch: "Prompt Chuyển Ảnh sang Sketch",
        lblArtistic: "Chuyển Đổi Phong Cách Nghệ Thuật",
        lblArtisticDesc: "Tạo prompt để chuyển đổi ảnh kiến trúc của bạn sang các phong cách vẽ nghệ thuật khác nhau.",
        lblCustomStyle: "Hình Mẫu Phong Cách",
        lblUploadStyle: "Tải Ảnh Mẫu Phong Cách",
        lblCustomInstruction: "Yêu Cầu Tùy Chỉnh",
        btnGenerateCustom: "Tạo Phong Cách",
        artisticStyles: {
            watercolor: "Màu Nước",
            blueInk: "Bút Bi Xanh",
            cleanLine: "Nét Vẽ Sạch",
            blackInk: "Kỹ Thuật Mực Đen",
            redInk: "Bút Đỏ"
        },
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
            multiViewPrompts: "Prompt Đa Góc Nhìn",
            collageAnalysis: "Phân Tích Chi Tiết Dự Án (DNA)"
        },
        apiModal: {
            title: "KHÓA MÃ HÓA",
            desc: "Cung cấp khóa ủy quyền để truy cập Pro-v3.1. Giao thức mặc định sử dụng Flash-v3.",
            placeholder: "[NHẬP_KHÓA]",
            btnCancel: "HỦY",
            btnSave: "ỦY QUYỀN",
            btnRemove: "THU HỒI QUYỀN",
            link: "Yêu cầu khóa"
        },
        modelSwitched: "Đã chuyển sang model "
    }
};

// --- DOM Elements ---
const tabAnalysis = getEl<HTMLButtonElement>('tab-analysis');
const tabNotes = getEl<HTMLButtonElement>('tab-notes');
const tabMultiView = getEl<HTMLButtonElement>('tab-multi-view');
const tabRemoveLogo = getEl<HTMLButtonElement>('tab-remove-logo');
const tabArtistic = getEl<HTMLButtonElement>('tab-artistic');
const tabTextOverlay = getEl<HTMLButtonElement>('tab-text-overlay');

const panelAnalysis = getEl<HTMLDivElement>('panel-analysis');
const panelNotes = getEl<HTMLDivElement>('panel-notes');
const panelMultiView = getEl<HTMLDivElement>('panel-multi-view');
const panelArtistic = getEl<HTMLDivElement>('panel-artistic');
const panelRemoveLogoSidebar = getEl<HTMLDivElement>('panel-remove-logo');
const panelUploadAnalysis = getEl<HTMLDivElement>('panel-upload-analysis');
const panelTextOverlaySettings = getEl<HTMLDivElement>('panel-text-overlay-settings');

// Global Action Bar Elements
const globalActionsBar = getEl<HTMLDivElement>('global-actions-bar');
const btnExpandAll = getEl<HTMLButtonElement>('btn-expand-all');
const btnCollapseAll = getEl<HTMLButtonElement>('btn-collapse-all');
const btnClearResults = getEl<HTMLButtonElement>('btn-clear-results');

// Text Overlay Global
const btnResetOverlay = getEl<HTMLButtonElement>('btn-reset-overlay');
const btnToggleAllBg = getEl<HTMLButtonElement>('btn-toggle-all-bg');
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
const logoSizeSlider = getEl<HTMLInputElement>('logo-size-slider');
const logoOpacitySlider = getEl<HTMLInputElement>('logo-opacity-slider');
const logoPositionSelect = getEl<HTMLSelectElement>('logo-position-select');
const logoSizeVal = getEl('logo-size-val');
const logoOpacityVal = getEl('logo-opacity-val');

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
const artisticResults = getEl<HTMLDivElement>('artistic-results');
const multiviewResults = getEl<HTMLDivElement>('multiview-results');
const multiviewGrid = getEl<HTMLDivElement>('multiview-grid');
const panelRemoveLogo = getEl<HTMLDivElement>('remove-logo-panel');
const logoRemovalGrid = getEl<HTMLDivElement>('logo-removal-grid');
const logoMultiDropZone = getEl<HTMLDivElement>('logo-multi-drop-zone');
const logoMultiFileInput = getEl<HTMLInputElement>('logo-multi-file-input');
const btnLogoGenAll = getEl<HTMLButtonElement>('btn-logo-gen-all');
const btnLogoDownloadAll = getEl<HTMLButtonElement>('btn-logo-download-all');
const btnLogoResetAll = getEl<HTMLButtonElement>('btn-logo-reset-all');
const btnAddLogoSlot = getEl<HTMLButtonElement>('btn-add-logo-slot');
const lblRemoveLogoTitle = getEl('lbl-remove-logo-title');
const lblRemoveLogoTitleSidebar = getEl('lbl-remove-logo-title-sidebar');
const lblRemoveLogoDesc = getEl('lbl-remove-logo-desc');
const lblRemoveLogoDescSidebar = getEl('lbl-remove-logo-desc-sidebar');
const lblLogoDragDrop = getEl('lbl-logo-drag-drop');

const analyzeBtn = getEl<HTMLButtonElement>('analyze-btn');
const analyzeViBtn = getEl<HTMLButtonElement>('analyze-vi-btn');
const analyzeNotesBtn = getEl<HTMLButtonElement>('analyze-notes-btn');
const btnAnalyzeMultiView = getEl<HTMLButtonElement>('btn-analyze-multi-view');
const btnAnalyzeMultiViewGen = getEl<HTMLButtonElement>('btn-analyze-multi-view-gen');
const btnDownloadAllMultiView = getEl<HTMLButtonElement>('btn-download-all-multiview');
const angleCountInput = getEl<HTMLInputElement>('angle-count');
const customAngleInput = getEl<HTMLTextAreaElement>('custom-angle-input');
const btnGenerateCustomAngle = getEl<HTMLButtonElement>('btn-generate-custom-angle');
const lblAngleCount = getEl('lbl-angle-count');
const lblCustomAngle = getEl('lbl-custom-angle');
const btnCustomAngleText = getEl('btn-custom-angle-text');
const lblObjAnalysis = getEl('lbl-obj-analysis');
const lblObjDesc = getEl('lbl-obj-desc');
const btnObjAnalysisText = getEl('btn-obj-analysis-text');
const btnAnalyzeNotesText = getEl('btn-analyze-notes-text');
const btnArtisticText = getEl('btn-artistic-text');
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
const resCollageAnalysis = getEl<HTMLParagraphElement>('res-collage-analysis');

// Titles
const titleStyle = getEl('title-style');
const titleMaterial = getEl('title-material');
const titleLighting = getEl('title-lighting');
const titleContext = getEl('title-context');
const titleComposition = getEl('title-composition');
const titlePrompt = getEl('title-prompt');
const titleSketchPrompt = getEl('title-sketch-prompt');
const titleCollageAnalysis = getEl('title-collage-analysis');

// Buttons for Single Analysis
const btnRunPrompt = getEl<HTMLButtonElement>('btn-run-prompt');
const btnRunSketchPrompt = getEl<HTMLButtonElement>('btn-run-sketch-prompt');

// Artistic Style Buttons
const btnStyleWatercolor = getEl<HTMLButtonElement>('btn-style-watercolor');
const btnStyleBlueInk = getEl<HTMLButtonElement>('btn-style-purple-ink');
const btnStyleCleanLine = getEl<HTMLButtonElement>('btn-style-clean-line');
const btnStyleBlackInk = getEl<HTMLButtonElement>('btn-style-black-ink');
const btnStyleRedInk = getEl<HTMLButtonElement>('btn-style-red-ink');

// Custom Artistic Style Elements
const dropZoneStyle = getEl<HTMLDivElement>('drop-zone-style');
const fileInputStyle = getEl<HTMLInputElement>('file-input-style');
const styleRefPreview = getEl<HTMLDivElement>('style-ref-preview');
const imgStyleRef = getEl<HTMLImageElement>('img-style-ref');
const styleRefPlaceholder = getEl<HTMLDivElement>('style-ref-placeholder');
const btnClearStyleRef = getEl<HTMLButtonElement>('btn-clear-style-ref');
const inputCustomStyle = getEl<HTMLTextAreaElement>('input-custom-style');
const btnGenerateCustomStyle = getEl<HTMLButtonElement>('btn-generate-custom-style');

const btnToSketchPrompt = getEl<HTMLButtonElement>('btn-to-sketch-prompt');
const resPhotoToSketch = getEl<HTMLParagraphElement>('res-photo-to-sketch');
const cardPhotoToSketch = getEl<HTMLDivElement>('card-photo-to-sketch');

const btnRunStyle = getEl<HTMLButtonElement>('btn-run-style');
const btnRunMaterial = getEl<HTMLButtonElement>('btn-run-material');
const btnRunLighting = getEl<HTMLButtonElement>('btn-run-lighting');
const btnRunContext = getEl<HTMLButtonElement>('btn-run-context');
const btnRunComposition = getEl<HTMLButtonElement>('btn-run-composition');
const btnCopyCollageAnalysis = getEl<HTMLButtonElement>('btn-copy-collage-analysis');
const btnDlCollageAnalysis = getEl<HTMLButtonElement>('btn-dl-collage-analysis');
const btnPngInfoPrompt = getEl<HTMLButtonElement>('btn-png-info-prompt');
const btnCopyMvDna = getEl<HTMLButtonElement>('btn-copy-mv-dna');
const resMvDna = getEl<HTMLParagraphElement>('res-mv-dna');
const cardMvDna = getEl<HTMLDivElement>('card-mv-dna');
const btnSendBanana = getEl<HTMLButtonElement>('btn-send-banana');
const btnSelectFolder = getEl<HTMLButtonElement>('btn-select-folder');


// Sketch Elements
const sketchContainer = getEl<HTMLDivElement>('sketch-container');
const sketchDropZone = getEl<HTMLDivElement>('sketch-drop-zone');
const sketchInput = getEl<HTMLInputElement>('sketch-input');
const sketchEmptyState = getEl<HTMLDivElement>('sketch-empty-state');
const sketchPreviewImg = getEl<HTMLImageElement>('sketch-preview-img');
const sketchClearBtn = getEl<HTMLButtonElement>('sketch-clear-btn');
const sketchPromptCard = getEl<HTMLDivElement>('card-sketch-prompt');
const collageAnalysisCard = getEl<HTMLDivElement>('card-collage-analysis');

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
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
const iconDl = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
const iconDlAll = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;
const iconCopyAll = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>`;
const iconCheckAll = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>`;
const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
const iconTriangle = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;
const iconRemove = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;
const iconPngInfo = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;

// Helper: Create mini button
const createMiniBtn = (iconSvg: string, onClick: (btn: HTMLButtonElement) => void, tooltip: string) => {
    const btn = document.createElement('button');
    btn.className = "p-1 hover:bg-white/10 rounded-none text-white hover:text-white transition-colors flex items-center justify-center";
    btn.title = tooltip;
    btn.innerHTML = iconSvg;
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick(btn);
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

// Helper: Save Blob (Supports Directory Handle)
async function saveBlob(blob: Blob, filename: string) {
    if (downloadDirectoryHandle) {
        try {
            const fileHandle = await downloadDirectoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            showStatus(`Saved: ${filename}`);
            return;
        } catch (err) {
            console.error("Directory write failed, falling back to standard download", err);
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helper: Trigger Download
async function triggerDownload(content: string, filename: string) {
    if(!content || content === "Waiting for analysis...") {
        showStatus('Nothing to download', true);
        return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    await saveBlob(blob, filename);
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
        const data = extractJson(metadata);
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
                const data = extractJson(metadata);
                let parts = [];
                if (data.mega) parts.push(`[PROMPT]:\n${data.mega}`);
                else if (data.generationPrompt?.en) parts.push(`[PROMPT]:\n${data.generationPrompt.en}`);
                else if (data.prompt) parts.push(`[PROMPT]:\n${data.prompt}`);
                
                if (data.lighting) parts.push(`[LIGHTING]:\n${data.lighting}`);
                if (data.scene) parts.push(`[SCENE]:\n${data.scene}`);
                if (data.view) parts.push(`[VIEW]:\n${data.view}`);
                
                if (parts.length > 0) return parts.join('\n\n');
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
    // Unified Style: Black bg, border green-500/20, rounded-none
    card.className = "w-full border border-green-500/20 rounded-none bg-black relative transition hover:border-green-500/50 mb-4 collapsible-card group";
    
    // Header (Clickable for Collapse)
    const header = document.createElement('div');
    header.className = "flex justify-between items-center p-4 border-b border-green-500/20 cursor-pointer card-header select-none";
    
    const titleDiv = document.createElement('div');
    titleDiv.className = "flex items-center gap-3";
    
    const triangleIcon = document.createElement('div');
    triangleIcon.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
    triangleIcon.className = "chevron-icon text-green-100 transition-transform duration-200";
    
    const h3 = document.createElement('h3');
    // Unified Title Style
    h3.className = "text-[10px] font-bold text-white uppercase tracking-widest"; 
    h3.textContent = title;
    
    titleDiv.appendChild(triangleIcon);
    titleDiv.appendChild(h3);
    header.appendChild(titleDiv);
    
    // Collapsible Content Wrapper
    const cardContent = document.createElement('div');
    cardContent.className = "card-content flex"; // Flex row for sidebar + content

    // --- Vertical Actions Sidebar ---
    const sidebar = document.createElement('div');
    sidebar.className = "w-12 flex flex-col items-center gap-3 py-4 bg-black border-r border-green-500/20 shrink-0";
    
    // Copy All Button
    const btnCopy = document.createElement('button');
    btnCopy.className = "p-1.5 text-white hover:text-green-200 transition-all";
    btnCopy.title = "Copy All";
    btnCopy.innerHTML = iconCopyAll;
    btnCopy.onclick = async (e) => {
        e.stopPropagation();
        const fullText = `[DETAILED CONTENT]:\n${content}\n\n[COMPOSITION & ANGLE]:\n${composition}\n\n[LIGHTING]:\n${lighting}`;
        const success = await copyToClipboard(fullText, btnCopy, iconCheckAll, iconCopyAll);
        if (success) {
            showStatus("Copied all 3 sections!");
            setTimeout(() => showStatus(''), 2000);
        } else {
            showStatus("Copy failed", true);
        }
    };

    // PNG Info Button
    const btnPngInfo = document.createElement('button');
    btnPngInfo.className = "p-1.5 text-gray-200 hover:text-green-200 transition-all";
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
        const success = await copyToClipboard(JSON.stringify(bananaData, null, 2));
        if (success) {
            showStatus("Copied PNG Info (JSON)!");
            setTimeout(() => showStatus(''), 2000);
        } else {
            showStatus("Copy failed", true);
        }
    };

    // Download Button
    const btnDownload = document.createElement('button');
    btnDownload.className = "p-1.5 text-gray-200 hover:text-green-400 transition-all";
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
    btnDelete.className = "p-1.5 text-gray-500 hover:text-red-500 transition-all";
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
    contentArea.className = "flex-1 p-6 overflow-hidden";
    
    const gridDiv = document.createElement('div');
    gridDiv.className = "grid grid-cols-1 md:grid-cols-3 gap-6";
    
    const createSection = (sectionTitle: string, sectionText: string, colorClass: string) => {
        const col = document.createElement('div');
        // Keep section color coding but ensure it fits the new container
        col.className = `p-4 rounded-none border flex flex-col h-full bg-black border-gray-900`;
        const secHeader = document.createElement('div');
        secHeader.className = "flex justify-between items-center mb-3";
        const secH = document.createElement('h5');
        secH.className = "font-bold text-[10px] uppercase tracking-widest text-gray-100";
        secH.textContent = sectionTitle;
        const actions = document.createElement('div');
        actions.className = "flex gap-2";
        actions.appendChild(createMiniBtn(iconCopy, async (btn) => { 
            const success = await copyToClipboard(sectionText, btn, iconCheck, iconCopy);
            if (success) {
                showStatus(`Copied ${sectionTitle}`);
                setTimeout(() => showStatus(''), 2000);
            } else {
                showStatus(`Copy failed`, true);
            }
        }, "Copy"));
        secHeader.appendChild(secH); secHeader.appendChild(actions);
        const p = document.createElement('p');
        p.className = "text-green-100 text-xs whitespace-pre-line font-mono leading-relaxed";
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
        // Fallback to custom modal if aistudio is not available
        if (apiKeyInput) apiKeyInput.value = customApiKey || '';
        setHidden(apiKeyModal, false);
    }
}

function showStatus(message: string, isError = false) {
  if (!statusMsg) return;
  statusMsg.textContent = message;
  statusMsg.className = isError 
    ? 'text-center text-xs text-red-400 h-4 truncate font-bold' 
    : 'text-center text-xs text-gray-200 h-4 truncate';
  
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
    if(btnAnalyzeMultiView) btnAnalyzeMultiView.disabled = true;
    if(btnAnalyzeMultiViewGen) btnAnalyzeMultiViewGen.disabled = true;
    if(btnGenerateCustomAngle) btnGenerateCustomAngle.disabled = true;
    if(analyzeNotesBtn) analyzeNotesBtn.disabled = true;
    if(btnLoadPngInfo) btnLoadPngInfo.disabled = true;
    if(dropZone) addClass(dropZone, 'pointer-events-none');
    if(resultsContainer) addClass(resultsContainer, 'opacity-50', 'pointer-events-none');
  } else {
    setHidden(loader, true);
    if(analyzeBtn) analyzeBtn.disabled = false;
    if(btnAnalyzeMultiView) btnAnalyzeMultiView.disabled = false;
    if(btnAnalyzeMultiViewGen) btnAnalyzeMultiViewGen.disabled = false;
    if(btnGenerateCustomAngle) btnGenerateCustomAngle.disabled = false;
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

// Image processing (Resizing & Canvas arrows burning)
async function processFileForGemini(file: File): Promise<{
  inlineData: {data: string; mimeType: string};
}> {
    const arrows = fileArrowMap.get(file);
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            // Optimization: Limit maximum dimension to 1024px for faster processing
            const MAX_DIM = 1024;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (width > height) {
                if (width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                }
            } else {
                if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(!ctx) { 
                fileToGenerativePart(file).then(resolve).catch(reject);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            if (arrows && arrows.length > 0) {
                arrows.forEach(arrow => {
                    const x1 = arrow.nx1 * canvas.width;
                    const y1 = arrow.ny1 * canvas.height;
                    const x2 = arrow.nx2 * canvas.width;
                    const y2 = arrow.ny2 * canvas.height;
                    
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
            }

            // Always compress as JPEG 0.8 to save bandwidth
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64Content = dataUrl.split(',')[1];
            resolve({ inlineData: { data: base64Content, mimeType: 'image/jpeg' } });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(img.src);
            reject(e);
        };
        img.src = URL.createObjectURL(file);
    });
}

// Internal AI process - now calling the server
async function generateContentWithRetry(params: any): Promise<any> {
    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: params.prompt,
            contents: params.contents.parts,
            model: params.model,
            config: params.generationConfig,
            apiKey: customApiKey
        })
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "AI Server Error");
    }
    
    return await response.json();
}

async function callGemini(prompt: string, files: File[], sketchFile: File | null = null): Promise<string> {
    const parts: any[] = [];
    
    if (files.length > 0) {
        parts.push({ text: "REFERENCE IMAGES:" });
        for (const file of files) {
            parts.push(await processFileForGemini(file));
        }
    }
    
    if (sketchFile) {
        parts.push({ text: "SKETCH IMAGE (to be rendered based on references):" });
        parts.push(await processFileForGemini(sketchFile));
    }
    
    parts.push({ text: prompt });

    const data = await generateContentWithRetry({
        prompt: prompt,
        model: currentModel,
        contents: { parts: parts },
        generationConfig: { responseMimeType: "application/json" }
    });
    
    return data.text || "{}";
}

// --- UI Logic ---

function updateApiUI() {
    const hasKey = !!customApiKey;
    setHidden(btnSettings, hasKey);
    setHidden(btnProBadge, !hasKey);
    setHidden(btnRemoveApiKey, !hasKey);

    // Automatically switch model based on API key presence
    if (modelSelect) {
        const targetModel = hasKey ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
        currentModel = targetModel;
        modelSelect.value = currentModel;
        localStorage.setItem('gemini_selected_model', currentModel);
        
        // Update model select options visibility or just keep the two
        // The user wants to remove others, which I did in HTML.
    }
}

function updateLanguageUI() {
    const t = translations[currentLang];
    
    // Static Text
    setText(appTitle, t.appTitle);
    setText(appSubtitle, t.appSubtitle);
    setText(lblUpload, t.uploadTitle);
    setText(lblDrag, t.uploadDrag);
    setText(lblUploadSketch, t.uploadSketch);
    setText(btnAnalyzeText, t.btnAnalyze);
    setText(getEl('btn-analyze-image-prompt-text'), t.btnAnalyzeImagePrompt || 'IMAGE PROMPT');
    setText(getEl('btn-to-sketch-text'), t.btnToSketch);
    setText(btnDownloadAllText, t.btnDownloadAll);
    setText(btnLoadPngInfoText, t.btnLoadPngInfo);
    setText(loaderTitle, t.loaderTitle);
    setText(loaderSubtitle, t.loaderSubtitle);
    if(tabAnalysis) setText(tabAnalysis, t.tabAnalysis);
    if(tabMultiView) setText(tabMultiView, t.btnMultiView);
    if(tabNotes) setText(tabNotes, t.tabNotes);
    if(tabArtistic) setText(tabArtistic, t.tabArtistic);
    if(tabRemoveLogo) setText(tabRemoveLogo, t.tabRemoveLogo);
    if(tabTextOverlay) setText(tabTextOverlay, t.tabTextOverlay);
    
    setText(lblRemoveLogoTitle, t.lblRemoveLogoTitle);
    setText(lblRemoveLogoDesc, t.lblRemoveLogoDesc);
    setText(lblLogoDragDrop, t.lblLogoDragDrop);
    setText(btnLogoGenAll, t.btnLogoGenAll);
    setText(btnLogoDownloadAll, t.btnLogoDownloadAll);
    setText(btnLogoResetAll, t.btnLogoResetAll);

    setText(lblAngleCount, t.lblAngleCount);
    setText(lblCustomAngle, t.lblCustomAngle);
    if(customAngleInput) customAngleInput.placeholder = t.customAnglePlaceholder;
    setText(btnCustomAngleText, t.btnCustomAngle);
    setText(lblObjAnalysis, t.lblObjAnalysis);
    setText(lblObjDesc, t.lblObjDesc);
    setText(btnObjAnalysisText, t.btnObjAnalysis);
    setText(getEl('btn-multi-view-text'), t.btnMultiView);
    setText(btnAnalyzeNotesText, t.btnAnalyzeNotes);
    
    setText(getEl('lbl-multi-view-title'), currentLang === 'en' ? 'Multi-View Generation' : 'Tạo Đa Góc Nhìn');
    setText(getEl('lbl-multi-view-subtitle'), currentLang === 'en' ? 'Multiple perspectives derived from unified object DNA.' : 'Nhiều góc nhìn khác nhau được tạo ra từ DNA dự án đồng nhất.');
    setText(btnDownloadAllMultiView, t.btnDownloadAll + " (.ZIP)");

    setText(getEl('lbl-artistic'), t.lblArtistic);
    setText(getEl('lbl-artistic-desc'), t.lblArtisticDesc);
    setText(getEl('lbl-custom-style'), t.lblCustomStyle);
    setText(getEl('lbl-upload-style'), t.lblUploadStyle);
    setText(getEl('lbl-custom-instruction'), t.lblCustomInstruction);
    setText(getEl('btn-generate-custom-text'), t.btnGenerateCustom);
    setText(getEl('style-watercolor-text'), t.artisticStyles.watercolor);
    setText(getEl('style-purple-ink-text'), t.artisticStyles.blueInk);
    setText(getEl('style-clean-line-text'), t.artisticStyles.cleanLine);
    setText(getEl('style-black-ink-text'), t.artisticStyles.blackInk);
    setText(getEl('style-red-ink-text'), t.artisticStyles.redInk);

    setText(titleStyle, t.titles.style);
    setText(titleMaterial, t.titles.materials);
    setText(titleLighting, t.titles.lighting);
    setText(titleContext, t.titles.context);
    setText(titleComposition, t.titles.composition);
    setText(titlePrompt, t.titles.generationPrompt);
    setText(titleSketchPrompt, t.titles.sketchPrompt);
    setText(getEl('title-photo-to-sketch'), t.titlePhotoToSketch);
    setText(titleCollageAnalysis, t.titles.collageAnalysis);

    // API Modal
    setText(getEl('api-modal-title'), t.apiModal.title);
    setText(getEl('api-modal-desc'), t.apiModal.desc);
    if (apiKeyInput) apiKeyInput.placeholder = t.apiModal.placeholder;
    setText(getEl('btn-save-api-key'), t.apiModal.btnSave);
    setText(getEl('btn-remove-api-key'), t.apiModal.btnRemove);
    setText(getEl('api-modal-link'), t.apiModal.link);

    updateApiUI();

    // Tab Logic
    setHidden(panelAnalysis, true);
    setHidden(panelNotes, true);
    setHidden(panelArtistic, true);
    setHidden(panelMultiView, true);
    setHidden(panelRemoveLogo, true);
    setHidden(panelTextOverlaySettings, true);
    setHidden(panelUploadAnalysis, true);
    setHidden(sketchContainer, true);
    
    setHidden(analysisCardsWrapper, true);
    setHidden(multiviewResults, true);
    setHidden(artisticResults, true);
    setHidden(notesResults, true);
    setHidden(overlayGrid, true);
    setHidden(panelRemoveLogoSidebar, true);
    
    // Hide Global Action Bar by default
    setHidden(globalActionsBar, true);

    removeClass(tabAnalysis, 'active');
    removeClass(tabNotes, 'active');
    removeClass(tabMultiView, 'active');
    removeClass(tabTextOverlay, 'active');
    removeClass(tabArtistic, 'active');
    removeClass(tabRemoveLogo, 'active');

    if (activeTab === 'analysis') {
        setHidden(panelAnalysis, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(sketchContainer, false);
        setHidden(analysisCardsWrapper, false);
        setHidden(globalActionsBar, false);
        addClass(tabAnalysis, 'active');

    } else if (activeTab === 'notes') {
        setHidden(panelNotes, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(notesResults, false);
        setHidden(globalActionsBar, false);
        addClass(tabNotes, 'active');
    
    } else if (activeTab === 'artistic') {
        setHidden(panelArtistic, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(artisticResults, false);
        setHidden(globalActionsBar, false);
        addClass(tabArtistic, 'active');
        renderArtisticResults();

    } else if (activeTab === 'textOverlay') {
        setHidden(panelTextOverlaySettings, false);
        setHidden(overlayGrid, false);
        addClass(tabTextOverlay, 'active');
        if (overlaySlots.length === 0) initOverlaySlots();
        renderOverlaySlots();
        setHidden(globalActionsBar, false); // Visible for Text Overlay too
    } else if (activeTab === 'multiView') {
        setHidden(panelMultiView, false);
        setHidden(panelUploadAnalysis, false);
        setHidden(multiviewResults, false);
        setHidden(globalActionsBar, false);
        addClass(tabMultiView, 'active');
        renderMultiViewResults();
    } else if (activeTab === 'removeLogo') {
        setHidden(panelRemoveLogo, false);
        setHidden(panelRemoveLogoSidebar, false);
        setHidden(globalActionsBar, false);
        addClass(tabRemoveLogo, 'active');
        if (logoRemovalSlots.length === 0) initLogoRemovalSlots();
        renderLogoRemovalSlots();
    }

    // Single Analysis Content
    if (lastAnalysisData) {
        if(resStyle) setText(resStyle, lastAnalysisData.style?.[currentLang] || "");
        if(resMaterial) setText(resMaterial, lastAnalysisData.materials?.[currentLang] || "");
        if(resLighting) setText(resLighting, lastAnalysisData.lighting?.[currentLang] || "");
        if(resContext) setText(resContext, lastAnalysisData.context?.[currentLang] || "");
        if(resComposition) setText(resComposition, lastAnalysisData.composition?.[currentLang] || "");
        if(resPrompt) setText(resPrompt, lastAnalysisData.generationPrompt?.[currentLang] || "");
        if(resPhotoToSketch) {
            const ptsText = lastAnalysisData.photoToSketchPrompt?.[currentLang] || "";
            setText(resPhotoToSketch, ptsText);
            setHidden(cardPhotoToSketch, !ptsText);
        }
        if(resSketchPrompt) {
            const sketchText = lastAnalysisData.sketchPrompt?.[currentLang] || "";
            setText(resSketchPrompt, sketchText);
            setHidden(sketchPromptCard, !sketchText);
        }
        if(resCollageAnalysis) {
            const collageText = lastAnalysisData.collageAnalysis?.[currentLang] || "";
            setText(resCollageAnalysis, collageText);
            setHidden(collageAnalysisCard, !collageText);

            // Sync with MultiView Tab's DNA card
            if (resMvDna && cardMvDna) {
                setText(resMvDna, collageText);
                setHidden(cardMvDna, !collageText);
            }
        }
    }

    // Render Logic for Views and Notes handled in respective functions
    if(activeTab === 'multiView') renderMultiViewResults();
    if(activeTab === 'artistic') renderArtisticResults();
    if(activeTab === 'notes') renderNotesResults();
    if(activeTab === 'removeLogo') renderLogoRemovalSlots();

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
        const header = card.querySelector('.card-header') as HTMLElement;
        if (header && !header.dataset.hasCollapsibleListener) {
            header.addEventListener('click', () => {
                card.classList.toggle('card-collapsed');
            });
            header.dataset.hasCollapsibleListener = 'true';
        }
    });
}

// Re-run setup whenever UI updates might affect static HTML
// (Note: renderMultiViewResults creates new elements, so it handles its own listeners if needed, 
// but currently createMultiViewCardHTML has built-in logic)

function renderMultiViewResults() {
    if (!multiviewGrid) return;
    multiviewGrid.innerHTML = '';
    
    if (customAnglesHistory.length === 0 && (!lastAnalysisData || !lastAnalysisData.multiViewPrompts)) {
        multiviewGrid.innerHTML = `
        <div class="col-span-full text-center py-20 text-gray-700 font-mono text-[10px] uppercase tracking-[0.2em] border border-gray-900 bg-black/50">
             ${currentLang === 'en' ? 'Phase 1: Object DNA established. Phase 2: Angles pending initiation.' : 'Phát hiện DNA Project. Đang chờ lệnh tạo đa góc nhìn.'}
        </div>`;
        return;
    }

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
                multiviewGrid.appendChild(card);
             }
        });
    }

    // 2. Batch Analysis (String Format)
    if (lastAnalysisData && lastAnalysisData.multiViewPrompts) {
         const mvDataEn = lastAnalysisData.multiViewPrompts.en || "";
         const mvDataVi = lastAnalysisData.multiViewPrompts.vi || "";
         
         const parsePrompts = (text: string) => {
             const items: {title: string, content: string, composition: string, lighting: string}[] = [];
             const sections = text.split('===ANGLE:');
             sections.forEach(sec => {
                 if(!sec.trim()) return;
                 const lines = sec.split('\n');
                 const title = lines[0].trim().replace('===', '');
                 let content = "", composition = "", lighting = "";
                 const cIdx = sec.indexOf('[CONTENT]:'), cmpIdx = sec.indexOf('[COMPOSITION]:'), lIdx = sec.indexOf('[LIGHTING]:');
                 if (cIdx !== -1) content = sec.substring(cIdx+10, cmpIdx !== -1 ? cmpIdx : (lIdx !== -1 ? lIdx : sec.length)).trim();
                 if (cmpIdx !== -1) composition = sec.substring(cmpIdx+14, lIdx !== -1 ? lIdx : sec.length).trim();
                 if (lIdx !== -1) lighting = sec.substring(lIdx+11).trim();
                 if (title) items.push({title, content, composition, lighting});
             });
             return items;
         };

         const enItems = parsePrompts(mvDataEn);
         const viItems = parsePrompts(mvDataVi);

         // Display based on current language
         const items = currentLang === 'en' ? enItems : viItems;
         items.forEach((item, idx) => {
             const card = createMultiViewCardHTML(`mv-${idx}`, item.title, item.content, item.composition, item.lighting);
             multiviewGrid.appendChild(card);
         });
    }
}

function renderArtisticResults() {
    if (!artisticResults) return;
    if (artisticHistory.length === 0) {
        artisticResults.innerHTML = `
        <div class="text-center py-12 text-gray-400 font-mono text-[10px] uppercase tracking-widest">
             ${currentLang === 'en' ? 'Upload images and select a style to begin.' : 'Tải ảnh lên và chọn một phong cách để bắt đầu.'}
        </div>`;
        return;
    }

    artisticResults.innerHTML = '';
    [...artisticHistory].reverse().forEach((entry, idx) => {
        const realIndex = artisticHistory.length - 1 - idx;
        const card = document.createElement('div');
        card.className = "w-full border border-green-500/20 rounded-none bg-black relative transition hover:border-green-500/50 mb-4 collapsible-card group";
        card.innerHTML = `
            <div class="flex justify-between items-center p-4 border-b border-green-500/20 cursor-pointer card-header select-none">
                 <div class="flex items-center gap-3">
                     <span class="chevron-icon text-green-400 transition-transform duration-200">
                         <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                     </span>
                     <h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-widest">${entry.style}</h3>
                 </div>
                 <div class="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                      <button class="btn-copy-artistic p-1.5 text-gray-700 hover:text-green-400 transition" title="Copy"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                      <button class="btn-delete-artistic p-1.5 text-gray-700 hover:text-red-500 transition" title="Delete"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                 </div>
            </div>
            <div class="card-content p-6">
                <p class="text-green-100 text-xs whitespace-pre-line font-mono leading-relaxed pl-4 border-l border-green-500/30">${entry[currentLang]}</p>
            </div>
        `;
        
        card.querySelector('.btn-copy-artistic')?.addEventListener('click', () => copyToClipboard(entry[currentLang], card.querySelector('.btn-copy-artistic') as HTMLElement, '<svg class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>', '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>'));
        card.querySelector('.btn-delete-artistic')?.addEventListener('click', () => { artisticHistory.splice(realIndex, 1); renderArtisticResults(); });
        card.querySelector('.card-header')?.addEventListener('click', () => {
             const content = card.querySelector('.card-content') as HTMLElement;
             const chevron = card.querySelector('.chevron-icon') as HTMLElement;
             content.classList.toggle('hidden');
             chevron.style.transform = content.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)';
        });
        
        artisticResults.appendChild(card);
    });
}

function renderNotesResults() {
    if (!notesResults) return;
    if (notesHistory.length === 0) {
        notesResults.innerHTML = `
        <div class="text-center py-12 text-gray-400 font-mono text-[10px] uppercase tracking-widest">
             ${currentLang === 'en' ? 'Upload images and click "Extract & Translate Notes" to begin.' : 'Tải ảnh lên và nhấn "Trích Xuất & Dịch Ghi Chú" để bắt đầu.'}
        </div>`;
        return;
    }

    notesResults.innerHTML = '';
    notesHistory.forEach((note, idx) => {
        const card = document.createElement('div');
        // Unified Style: Black bg, border green-500/20, rounded-none
        card.className = "w-full border border-green-500/20 rounded-none bg-black relative transition hover:border-green-500/50 mb-4 collapsible-card group";
        
        // Header
        const header = document.createElement('div');
        header.className = "flex justify-between items-center p-4 border-b border-green-500/20 cursor-pointer card-header select-none";
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="chevron-icon text-green-400 transition-transform duration-200"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></span>
                <h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Note #${idx+1}: ${note.file.name}</h3>
            </div>
        `;
        header.onclick = () => card.classList.toggle('card-collapsed');

        // Content
        const content = document.createElement('div');
        content.className = "card-content p-6";
        
        const row = document.createElement('div');
        row.className = "flex flex-col md:flex-row gap-6 overflow-hidden";
        
        // Col 1: Image
        const imgContainer = document.createElement('div');
        imgContainer.className = "w-full md:w-1/4 shrink-0 relative group cursor-pointer border border-green-500/20 rounded-none overflow-hidden bg-black";
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
            col.className = "flex-1 flex border border-green-500/20 rounded-none overflow-hidden bg-black";
            
            // Sidebar
            const sidebar = document.createElement('div');
            sidebar.className = "w-12 flex flex-col items-center gap-3 py-4 bg-black border-r border-green-500/20";
            
            // Copy Btn
            const copyBtn = document.createElement('button');
            copyBtn.className = `p-1.5 text-gray-700 hover:text-green-400 transition`;
            copyBtn.innerHTML = iconCopy;
            copyBtn.onclick = async (e) => {
                 e.stopPropagation();
                 const success = await copyToClipboard(text, copyBtn, iconCheck, iconCopy);
                 if (success) {
                     showStatus('Copied!');
                     setTimeout(()=>showStatus(''), 2000);
                 } else {
                     showStatus('Copy failed', true);
                 }
            };
            
            // Download Btn
            const dlBtn = document.createElement('button');
            dlBtn.className = `p-1.5 text-gray-700 hover:text-green-400 transition`;
            dlBtn.innerHTML = iconDl;
            dlBtn.onclick = (e) => { e.stopPropagation(); triggerDownload(text, `Note_${title}.txt`); };

            sidebar.appendChild(copyBtn);
            sidebar.appendChild(dlBtn);
            
            // Text Content
            const contentDiv = document.createElement('div');
            contentDiv.className = "flex-1 p-4";
            const h4 = document.createElement('h4');
            h4.className = `text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-widest`;
            h4.textContent = title;
            const p = document.createElement('p');
            p.className = "text-green-300 text-xs font-mono whitespace-pre-wrap leading-relaxed";
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
        hasBackground: true,
        resultSrc: null,
        isTranslating: false,
        originalName: null,
        isCollapsed: false
    };
}

function renderOverlaySlots() {
    if (!overlayGrid) return;
    overlayGrid.innerHTML = '';
    
    overlaySlots.forEach((slot, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = "w-full border border-green-500/20 rounded-none bg-black relative transition hover:border-green-500/50 mb-4 collapsible-card group";
        if (slot.isCollapsed) {
            slotEl.classList.add('card-collapsed');
        }
        
        // Header
        const header = document.createElement('div');
        header.className = "flex justify-between items-center p-4 border-b border-green-500/20 cursor-pointer card-header select-none";
        
        const titleDiv = document.createElement('div');
        titleDiv.className = "flex items-center gap-3";
        const triangleIcon = document.createElement('div');
        triangleIcon.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
        triangleIcon.className = "chevron-icon text-green-400 transition-transform duration-200";
        const span = document.createElement('span');
        span.className = "text-[10px] font-bold text-gray-500 uppercase tracking-widest";
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
        
        header.onclick = () => {
            slot.isCollapsed = !slot.isCollapsed;
            slotEl.classList.toggle('card-collapsed', slot.isCollapsed);
        };
        slotEl.appendChild(header);

        // Content
        const cardContent = document.createElement('div');
        cardContent.className = "card-content p-6";

        // Grid Content (3 columns horizontal)
        const gridContent = document.createElement('div');
        gridContent.className = "grid grid-cols-1 lg:grid-cols-3 gap-6";

        // --- Column 1: Upload / Preview ---
        const colUpload = document.createElement('div');
        colUpload.className = "flex flex-col gap-3";
        colUpload.innerHTML = `<label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">1. Source Image</label>`;
        
        const imgZone = document.createElement('div');
        imgZone.className = "flex-1 min-h-[300px] rounded-none bg-black border border-green-500/20 relative overflow-hidden group/zone cursor-pointer flex items-center justify-center";
        
        if (slot.imgSrc) {
            const img = document.createElement('img');
            img.src = slot.imgSrc;
            img.className = "w-full h-full object-contain opacity-90";
            const clearImgBtn = document.createElement('button');
            clearImgBtn.className = "absolute top-2 right-2 bg-red-600/80 text-white w-6 h-6 rounded-none-full flex items-center justify-center text-xs opacity-0 group-hover/zone:opacity-100 transition-opacity z-10";
            clearImgBtn.innerHTML = "×";
            clearImgBtn.onclick = (e) => {
                e.stopPropagation();
                updateSlot(index, { imgSrc: null, file: null, resultSrc: null, text: "", originalName: null });
            };
            imgZone.appendChild(img);
            imgZone.appendChild(clearImgBtn);
        } else {
            imgZone.innerHTML = `<p class="text-[10px] text-gray-700 uppercase tracking-widest text-center px-4">Click/Drop Image</p>`;
            imgZone.classList.add("border-dashed", "hover:bg-gray-900");
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
        
        imgZone.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); imgZone.classList.add('border-purple-500'); };
        imgZone.ondragleave = (e) => { e.preventDefault(); e.stopPropagation(); imgZone.classList.remove('border-purple-500'); };
        imgZone.ondrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            imgZone.classList.remove('border-purple-500');
            
            const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;

            // Handle the first file for the current slot
            await handleSlotFile(index, files[0]);

            // Handle remaining files by filling subsequent empty slots or creating new ones
            if (files.length > 1) {
                let currentFileIdx = 1;
                let currentSlotIdx = index + 1;

                while (currentFileIdx < files.length) {
                    // Check if we need to create a new slot
                    if (currentSlotIdx >= overlaySlots.length) {
                        overlaySlots.push(createEmptySlot());
                    }

                    // Check if current slot is empty (no file)
                    if (!overlaySlots[currentSlotIdx].file) {
                        await handleSlotFile(currentSlotIdx, files[currentFileIdx]);
                        currentFileIdx++;
                    }
                    
                    currentSlotIdx++;
                }
                // Re-render to show all new slots/images
                renderOverlaySlots();
            }
        };

        colUpload.appendChild(imgZone);
        colUpload.appendChild(slotInput);

        // --- Column 2: Text / Edit ---
        const colEdit = document.createElement('div');
        colEdit.className = "flex flex-col gap-3";
        colEdit.innerHTML = `<label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">2. Edit Text</label>`;
        
        const textArea = document.createElement('textarea');
        textArea.className = "flex-1 h-64 bg-black border border-gray-900 rounded-none p-4 text-xs text-green-300 focus:border-green-500 outline-none resize-none overlay-textarea font-mono";
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
        controls.className = "flex gap-2 mt-auto h-10";
        
        const themeBtn = document.createElement('button');
        themeBtn.className = `flex-1 rounded-none border text-[10px] font-bold uppercase tracking-widest transition-colors ${slot.isDarkText ? 'bg-white text-black border-white' : 'bg-black text-gray-500 border-gray-900 hover:border-green-500/50'}`;
        themeBtn.innerText = slot.isDarkText ? "Dark Text" : "Light Text";
        themeBtn.onclick = () => updateSlot(index, { isDarkText: !slot.isDarkText });

        const bgBtn = document.createElement('button');
        bgBtn.className = `flex-1 rounded-none border text-[10px] font-bold uppercase tracking-widest transition-colors ${slot.hasBackground ? 'bg-gray-900 text-white border-gray-700' : 'bg-transparent text-gray-700 border-gray-900 hover:border-green-500/50'}`;
        bgBtn.innerText = slot.hasBackground ? "BG: ON" : "BG: OFF";
        bgBtn.onclick = () => updateSlot(index, { hasBackground: !slot.hasBackground });

        const translateBtn = document.createElement('button');
        translateBtn.className = "w-12 rounded-none border border-gray-900 bg-black text-gray-500 hover:text-green-400 hover:border-green-500/50 flex items-center justify-center transition-colors";
        translateBtn.title = "Translate (VN/EN)";
        translateBtn.innerHTML = slot.isTranslating 
            ? `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>`;
        translateBtn.onclick = () => handleTranslate(index);
        
        const embedBtn = document.createElement('button');
        embedBtn.className = "flex-1 rounded-none border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black font-bold text-[10px] uppercase tracking-widest transition-colors";
        embedBtn.innerText = "Embed";
        embedBtn.onclick = () => processSlotEmbed(index);

        controls.appendChild(themeBtn);
        controls.appendChild(bgBtn);
        controls.appendChild(translateBtn);
        controls.appendChild(embedBtn);
        colEdit.appendChild(textArea);
        colEdit.appendChild(controls);

        // --- Column 3: Result ---
        const colResult = document.createElement('div');
        colResult.className = "flex flex-col gap-3";
        colResult.innerHTML = `<label class="text-[10px] text-green-400 font-bold uppercase tracking-widest">3. Result Output</label>`;
        
        const resultImgZone = document.createElement('div');
        resultImgZone.className = "flex-1 min-h-[300px] rounded-none bg-black border border-gray-900 relative overflow-hidden flex items-center justify-center";
        
        if (slot.resultSrc) {
            resultImgZone.classList.add("cursor-zoom-in", "group/zone");
            resultImgZone.onclick = () => openZoomModal(slot.resultSrc!);
            
            const resImg = document.createElement('img');
            resImg.src = slot.resultSrc;
            resImg.className = "w-full h-full object-contain";
            
            const zoomOverlay = document.createElement('div');
            zoomOverlay.className = "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/zone:opacity-100 transition-opacity pointer-events-none";
            zoomOverlay.innerHTML = `<span class="text-white text-[10px] font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-none">Zoom</span>`;
            
            const dlBtn = document.createElement('button');
            dlBtn.className = "absolute top-2 right-2 bg-green-600/90 text-white p-1.5 rounded-none transition-colors z-10 pointer-events-auto hover:bg-green-500";
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
            resultImgZone.innerHTML = `<p class="text-xs text-gray-300 italic">Waiting for embed...</p>`;
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
        const data = await generateContentWithRetry({
            prompt: `Translate the following text to English if it is Vietnamese, or to Vietnamese if it is English. Maintain the tone and style. Return ONLY the translated text.\n\nText: ${text}`,
            model: currentModel,
            contents: { parts: [{ text: `Translate the following text to English if it is Vietnamese, or to Vietnamese if it is English. Maintain the tone and style. Return ONLY the translated text.\n\nText: ${text}` }] }
        });
        
        const translated = data.text || text;
        updateSlot(index, { text: translated, isTranslating: false });
        showStatus('Translated!');
    } catch (e) {
        handleApiError(e, 'Translation failed');
        updateSlot(index, { isTranslating: false });
    }
}

// --- Logo Removal Functions ---
function initLogoRemovalSlots() {
    logoRemovalSlots = [
        createEmptyLogoSlot(),
        createEmptyLogoSlot(),
        createEmptyLogoSlot()
    ];
}

function createEmptyLogoSlot(): LogoRemovalSlot {
    return {
        id: Math.random().toString(36).substr(2, 9),
        file: null,
        imgSrc: null,
        resultSrc: null,
        isProcessing: false
    };
}

function renderLogoRemovalSlots() {
    if (!logoRemovalGrid) return;
    logoRemovalGrid.innerHTML = '';

    if (logoRemovalSlots.length === 0) {
        logoRemovalGrid.innerHTML = `
            <div class="col-span-full py-20 text-center border border-dashed border-gray-800 bg-black/10">
                <p class="text-[10px] text-gray-600 uppercase font-bold tracking-widest">No images uploaded yet</p>
            </div>
        `;
        return;
    }

    logoRemovalSlots.forEach((slot, index) => {
        const slotEl = document.createElement('div');
        slotEl.className = "w-full border border-green-500/20 rounded-none bg-black/40 relative transition hover:border-green-500/40 p-4 flex flex-col gap-4 group";
        
        // Header
        const header = document.createElement('div');
        header.className = "flex justify-between items-center border-b border-green-500/10 pb-2";
        header.innerHTML = `<span class="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Slot ${index + 1}</span>`;
        
        const delBtn = document.createElement('button');
        delBtn.className = "text-xs text-red-500 hover:text-red-300 px-2";
        delBtn.innerHTML = "×";
        delBtn.onclick = () => {
            logoRemovalSlots.splice(index, 1);
            renderLogoRemovalSlots();
        };
        header.appendChild(delBtn);
        slotEl.appendChild(header);

        // Upload/Preview Area
        const uploadArea = document.createElement('div');
        uploadArea.className = "relative h-48 border border-dashed border-gray-800 rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-900/50 transition-all overflow-hidden";
        
        // Drag and Drop support
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-green-500', 'bg-green-500/5');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-green-500', 'bg-green-500/5');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-green-500', 'bg-green-500/5');
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                handleLogoSlotFile(index, file);
            }
        });

        if (slot.imgSrc) {
            const img = document.createElement('img');
            img.src = slot.imgSrc;
            img.className = "w-full h-full object-contain";
            uploadArea.appendChild(img);
            
            const clearBtn = document.createElement('button');
            clearBtn.className = "absolute top-1 right-1 bg-red-900/80 text-white w-5 h-5 rounded-none flex items-center justify-center text-xs hover:bg-red-600 z-10";
            clearBtn.innerHTML = "×";
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                slot.file = null;
                slot.imgSrc = null;
                slot.resultSrc = null;
                renderLogoRemovalSlots();
            };
            uploadArea.appendChild(clearBtn);
        } else {
            uploadArea.innerHTML = `
                <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span class="text-[8px] text-gray-600 uppercase font-bold tracking-tighter">Upload Image</span>
                </div>
            `;
            uploadArea.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleLogoSlotFile(index, file);
                };
                input.click();
            };
        }

        // Paste Button - Always visible
        const pasteBtn = document.createElement('button');
        pasteBtn.className = "absolute bottom-2 left-2 bg-black/60 text-gray-400 p-1.5 rounded-none hover:text-green-400 transition-colors z-20";
        pasteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>`;
        pasteBtn.title = "Paste Image (Ctrl+V)";
        
        const performPaste = async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        for (const type of item.types) {
                            if (type.startsWith('image/')) {
                                const blob = await item.getType(type);
                                const file = new File([blob], `pasted_image_${Date.now()}.png`, { type });
                                handleLogoSlotFile(index, file);
                                return;
                            }
                        }
                    }
                    showStatus('No image found in clipboard');
                } else {
                    showStatus('Clipboard API not supported in this environment. Try Ctrl+V directly.', true);
                }
            } catch (err) {
                showStatus('Clipboard access denied or restricted.');
            }
        };

        pasteBtn.onclick = (e) => {
            e.stopPropagation();
            performPaste();
        };
        uploadArea.appendChild(pasteBtn);

        // Add a local listener for the upload area to catch Ctrl+V when focused or hovered
        uploadArea.tabIndex = 0; // Make it focusable
        uploadArea.addEventListener('paste', (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: blob.type });
                            handleLogoSlotFile(index, file);
                            e.preventDefault();
                            return;
                        }
                    }
                }
            }
        });
        slotEl.appendChild(uploadArea);

        // Result Area (if exists)
        if (slot.resultSrc) {
            const resultArea = document.createElement('div');
            resultArea.className = "relative h-48 border border-green-500/20 rounded-none overflow-hidden group/res";
            const resImg = document.createElement('img');
            resImg.src = slot.resultSrc;
            resImg.className = "w-full h-full object-contain";
            resultArea.appendChild(resImg);
            
            const dlBtn = document.createElement('button');
            dlBtn.className = "absolute bottom-2 right-2 bg-green-600 text-white p-1.5 rounded-none hover:bg-green-500 transition-colors opacity-0 group-hover/res:opacity-100";
            dlBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
            dlBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = slot.resultSrc!;
                a.download = `Cleaned_${slot.file?.name || 'image.png'}`;
                a.click();
            };
            resultArea.appendChild(dlBtn);
            slotEl.appendChild(resultArea);
        }

        // Action Button
        const genBtn = document.createElement('button');
        genBtn.className = `w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${slot.isProcessing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-black'}`;
        genBtn.innerHTML = slot.isProcessing ? 'Processing...' : 'GEN (Remove Logo)';
        genBtn.disabled = slot.isProcessing || !slot.file;
        genBtn.onclick = () => processLogoRemoval(index);
        slotEl.appendChild(genBtn);

        logoRemovalGrid.appendChild(slotEl);
    });
}

async function handleLogoMultiUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    
    // Convert FileList to Array if necessary
    const fileArray = Array.from(files);
    
    // Ensure we have at least 3 slots if we are in logo removal tab
    if (logoRemovalSlots.length < 3) initLogoRemovalSlots();

    // Fill existing empty slots first
    let fileIndex = 0;
    for (let i = 0; i < logoRemovalSlots.length && fileIndex < fileArray.length; i++) {
        if (!logoRemovalSlots[i].file) {
            logoRemovalSlots[i].file = fileArray[fileIndex];
            logoRemovalSlots[i].imgSrc = URL.createObjectURL(fileArray[fileIndex]);
            fileIndex++;
        }
    }
    
    // Add remaining files as new slots
    for (let i = fileIndex; i < fileArray.length; i++) {
        const slot = createEmptyLogoSlot();
        slot.file = fileArray[i];
        slot.imgSrc = URL.createObjectURL(fileArray[i]);
        logoRemovalSlots.push(slot);
    }
    
    renderLogoRemovalSlots();
    showStatus(`Added ${fileArray.length} images to removal queue.`);
}

async function processLogoGenAll() {
    const pendingSlots = logoRemovalSlots.filter(s => s.file && !s.resultSrc && !s.isProcessing);
    if (pendingSlots.length === 0) {
        showStatus("No pending images to process.", true);
        return;
    }

    showStatus(`Processing ${pendingSlots.length} images...`);
    
    // Process sequentially to avoid overwhelming API or just use Promise.all with limited concurrency if needed
    for (const slot of pendingSlots) {
        const index = logoRemovalSlots.indexOf(slot);
        if (index !== -1) {
            await processLogoRemoval(index);
        }
    }
    showStatus("All pending images processed.");
}

async function processLogoDownloadAll() {
    const slotsToDownload = logoRemovalSlots.filter(s => s.resultSrc);
    if (slotsToDownload.length === 0) {
        showStatus("No cleaned images to download.", true);
        return;
    }

    if (slotsToDownload.length === 1) {
        const slot = slotsToDownload[0];
        const a = document.createElement('a');
        a.href = slot.resultSrc!;
        a.download = `Cleaned_${slot.file?.name || 'image.png'}`;
        a.click();
        return;
    }

    showStatus(`Preparing ZIP with ${slotsToDownload.length} images...`);
    const zip = new JSZip();
    for (const slot of slotsToDownload) {
        const base64Data = slot.resultSrc!.split(',')[1];
        const fileName = `Cleaned_${slot.file?.name || 'image.png'}`;
        zip.file(fileName, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cleaned_Images_Batch.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus("Download complete!");
}

function processLogoResetAll() {
    logoRemovalSlots = [
        createEmptyLogoSlot(),
        createEmptyLogoSlot(),
        createEmptyLogoSlot()
    ];
    renderLogoRemovalSlots();
    showStatus("All slots cleared.");
}

async function handleLogoSlotFile(index: number, file: File) {
    const src = URL.createObjectURL(file);
    logoRemovalSlots[index].file = file;
    logoRemovalSlots[index].imgSrc = src;
    logoRemovalSlots[index].resultSrc = null;
    renderLogoRemovalSlots();
}

async function callGeminiImageEdit(prompt: string, file: File): Promise<string | null> {
    const parts: any[] = [
        await processFileForGemini(file),
        { text: prompt }
    ];

    try {
        const data = await generateContentWithRetry({
            prompt: prompt,
            model: 'gemini-2.5-flash-image',
            contents: { parts: parts }
        });

        return data.imageUrl || null;
    } catch (err) {
        console.error("Server-side Gemini call failed:", err);
    }
    return null;
}

async function processLogoRemoval(index: number) {
    const slot = logoRemovalSlots[index];
    if (!slot.file) return;

    slot.isProcessing = true;
    renderLogoRemovalSlots();

    try {
        console.log("Starting logo removal for slot:", index);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = slot.imgSrc!;
        });
        console.log("Image loaded, dimensions:", img.naturalWidth, "x", img.naturalHeight);

        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const prompt = "Perform high-quality inpainting to remove the logo (Gemini star, RunningHub AI, or any star-shaped watermark) from the image. Carefully reconstruct the underlying architectural details, textures, and lighting in the area where the logo was removed to ensure a seamless, natural-looking result. Do not alter any other part of the image.";

        // Always use full image processing for better reliability
        console.log("Processing logo removal using full image...");
        showStatus("Processing logo removal...");
        
        const result = await callGeminiImageEdit(prompt, slot.file);
        
        if (result) {
            slot.resultSrc = result;
            showStatus("Logo removed successfully!");
        } else {
            showStatus("Failed to remove logo.", true);
        }
    } catch (e) {
        console.error("Logo removal failed:", e);
        showStatus("Logo removal failed. Please try again.", true);
    } finally {
        slot.isProcessing = false;
        renderLogoRemovalSlots();
    }
}

// Embed Function (Canvas based)
async function processSlotEmbed(index: number): Promise<void> {
    const slot = overlaySlots[index];
    if (!slot.file || !slot.imgSrc) { 
        showStatus('No image in slot!', true); 
        return Promise.resolve(); 
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.src = slot.imgSrc!;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if(!ctx) { resolve(); return; }

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
                if (slot.hasBackground) {
                    const grad = ctx.createLinearGradient(0, boxY, 0, canvas.height);
                    const bgColor = slot.isDarkText ? "255, 255, 255" : "0, 0, 0";
                    grad.addColorStop(0, `rgba(${bgColor}, 0.3)`); 
                    grad.addColorStop(1, `rgba(${bgColor}, 0.7)`);
                    
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, boxY, canvas.width, boxHeight);
                }

                // Text Drawing with Auto-Scaling 
                const text = slot.text.trim();
                if(text) {
                    let fontSize = Math.floor(canvas.width / 42); 
                    const minFontSize = Math.floor(canvas.width / 100); 
                    
                    ctx.font = `bold ${fontSize}px "${globalFont}", sans-serif`;
                    
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

                    while (measureTextHeight(fontSize) > maxHeight && fontSize > minFontSize) {
                        fontSize -= 2;
                    }

                    ctx.font = `bold ${fontSize}px "${globalFont}", sans-serif`;
                    ctx.fillStyle = slot.isDarkText ? '#1a1a1a' : '#ffffff';
                    ctx.shadowColor = slot.isDarkText ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 4;
                    ctx.textBaseline = 'top';
                    
                    const lineHeight = fontSize * 1.4;
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
                     const textHeight = sigSize; 
                     
                     const rightMargin = canvas.width * 0.03;
                     const bottomMargin = canvas.width * 0.03;
                     
                     const rectWidth = textWidth + (paddingX * 2);
                     const rectHeight = textHeight + (paddingY * 2);
                     
                     const rectX = canvas.width - rightMargin - rectWidth;
                     const rectY = canvas.height - bottomMargin - rectHeight;
                     
                     ctx.shadowBlur = 4;
                     ctx.shadowColor = 'rgba(0,0,0,0.3)';
                     ctx.fillStyle = hexToRgba(globalSigBgColor, 0.85); 
                     
                     roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 8); 
                     
                     const bgHex = globalSigBgColor.toUpperCase();
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

                const finalUrl = canvas.toDataURL('image/png');
                updateSlot(index, { resultSrc: finalUrl });
                resolve();
            };

            if (globalLogoSrc) {
                const logoImg = new Image();
                logoImg.src = globalLogoSrc;
                logoImg.crossOrigin = "anonymous";
                logoImg.onload = () => {
                    const oldAlpha = ctx.globalAlpha;
                    ctx.globalAlpha = globalLogoOpacity / 100;
                    
                    const maxLogoW = canvas.width * (globalLogoSize / 100); 
                    const scale = Math.min(maxLogoW / logoImg.naturalWidth, 1);
                    const drawW = logoImg.naturalWidth * scale;
                    const drawH = logoImg.naturalHeight * scale;
                    
                    const logoX = (canvas.width - drawW) / 2;
                    
                    let logoY = 0;
                    const canvasPadding = canvas.height * 0.05;
                    if (globalLogoPosition === 'top') {
                        logoY = (canvas.height / 6) - (drawH / 2);
                    } else if (globalLogoPosition === 'middle') {
                        logoY = (canvas.height / 2) - (drawH / 2);
                    } else { 
                        logoY = (canvas.height * 5 / 6) - (drawH / 2);
                    }
                    
                    if (logoY < canvasPadding) logoY = canvasPadding;
                    if (logoY + drawH > canvas.height - canvasPadding) logoY = canvas.height - canvasPadding - drawH;

                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
                    ctx.shadowBlur = 0; 
                    
                    ctx.globalAlpha = oldAlpha;
                    drawContent();
                };
                logoImg.onerror = () => {
                    console.error("Failed to load logo image for canvas");
                    drawContent(); 
                }
            } else {
                drawContent();
            }
        };
        img.onerror = () => {
            console.error("Failed to load main image for canvas");
            resolve();
        };
    });
}

async function processEmbedAll() {
    showStatus('Starting Batch Embed...');
    for (let i = 0; i < overlaySlots.length; i++) {
        const slot = overlaySlots[i];
        if (slot.file) {
            // Processing all slots that have files, even if text is empty (to apply logo/signature)
            await processSlotEmbed(i);
            // Smaller visual delay
            await new Promise(r => setTimeout(r, 50)); 
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
    
    // Reset zoom state
    zoomScale = 1;
    zoomTranslateX = 0;
    zoomTranslateY = 0;
    
    // Ensure image fits within viewport initially
    zoomImg.style.maxWidth = '100%';
    zoomImg.style.maxHeight = '100%';
    zoomImg.style.objectFit = 'contain';
    zoomImg.style.transform = `translate(0px, 0px) scale(1)`;
    
    // Allow zooming to expand beyond container
    // We need to wait for image load to know dimensions if we want precise control,
    // but CSS max-width/height handles "fit to screen" well.
    // The transform will handle the actual zooming.
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

// Model Selector Listener
if (modelSelect) {
    if (localStorage.getItem('gemini_selected_model')) {
        modelSelect.value = localStorage.getItem('gemini_selected_model') || "";
    }
    // Fallback if the stored model is no longer in the list
    if (modelSelect.selectedIndex === -1) {
        currentModel = customApiKey ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
        modelSelect.value = currentModel;
        localStorage.setItem('gemini_selected_model', currentModel);
    }
    modelSelect.addEventListener('change', () => {
        currentModel = modelSelect.value;
        localStorage.setItem('gemini_selected_model', currentModel);
        const t = translations[currentLang];
        showStatus(`${t.modelSwitched}${modelSelect.options[modelSelect.selectedIndex].text}`);
    });
}

// API Key Modal Listeners
if (btnSettings) {
    btnSettings.addEventListener('click', () => {
        if (apiKeyInput) apiKeyInput.value = customApiKey || '';
        setHidden(apiKeyModal, false);
    });
}
if (btnProBadge) {
    btnProBadge.addEventListener('click', () => {
        localStorage.removeItem('gemini_custom_api_key');
        customApiKey = null;
        updateApiUI();
        const t = translations[currentLang];
        showStatus(t.apiModal.btnRemove + ' Successful');
    });
}
if (btnCloseApiModal) {
    btnCloseApiModal.addEventListener('click', () => {
        setHidden(apiKeyModal, true);
    });
}
if (btnSaveApiKey) {
    btnSaveApiKey.addEventListener('click', () => {
        if (apiKeyInput) {
            const val = apiKeyInput.value.trim();
            if (val) {
                customApiKey = val;
                localStorage.setItem('gemini_custom_api_key', val);
                showStatus('API Key saved locally.');
                updateApiUI();
            } else {
                customApiKey = null;
                localStorage.removeItem('gemini_custom_api_key');
                showStatus('API Key removed.');
                updateApiUI();
            }
        }
        setHidden(apiKeyModal, true);
    });
}
if (btnRemoveApiKey) {
    btnRemoveApiKey.addEventListener('click', () => {
        customApiKey = null;
        localStorage.removeItem('gemini_custom_api_key');
        if (apiKeyInput) apiKeyInput.value = '';
        showStatus('API Key removed.');
        updateApiUI();
        setHidden(apiKeyModal, true);
    });
}

if (langToggleBtn) langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'vi' : 'en';
    updateLanguageUI();
});
if (tabAnalysis) tabAnalysis.addEventListener('click', () => { activeTab = 'analysis'; updateLanguageUI(); });
if (tabMultiView) tabMultiView.addEventListener('click', () => { activeTab = 'multiView'; updateLanguageUI(); });
if (tabArtistic) tabArtistic.addEventListener('click', () => { activeTab = 'artistic'; updateLanguageUI(); });
if (tabNotes) tabNotes.addEventListener('click', () => { activeTab = 'notes'; updateLanguageUI(); });
if (tabRemoveLogo) tabRemoveLogo.addEventListener('click', () => { activeTab = 'removeLogo'; updateLanguageUI(); });
if (tabTextOverlay) tabTextOverlay.addEventListener('click', () => { activeTab = 'textOverlay'; updateLanguageUI(); });

// Logo Removal Listeners
if (logoMultiDropZone && logoMultiFileInput) {
    logoMultiDropZone.addEventListener('click', () => logoMultiFileInput.click());
    logoMultiFileInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
            handleLogoMultiUpload(files);
            (e.target as HTMLInputElement).value = '';
        }
    });

    logoMultiDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoMultiDropZone.classList.add('border-green-500', 'bg-black/40');
    });
    logoMultiDropZone.addEventListener('dragleave', () => {
        logoMultiDropZone.classList.remove('border-green-500', 'bg-black/40');
    });
    logoMultiDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        logoMultiDropZone.classList.remove('border-green-500', 'bg-black/40');
        const files = e.dataTransfer?.files;
        if (files) handleLogoMultiUpload(files);
    });

    // Global Paste Listener for the entire panel
    panelRemoveLogo.addEventListener('paste', (e: ClipboardEvent) => {
        if (activeTab !== 'removeLogo') return;
        const items = e.clipboardData?.items;
        if (items) {
            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        files.push(new File([blob], `pasted_batch_${Date.now()}_${i}.png`, { type: blob.type }));
                    }
                }
            }
            if (files.length > 0) {
                handleLogoMultiUpload(files);
                e.preventDefault();
            }
        }
    });
}

if (btnLogoGenAll) btnLogoGenAll.addEventListener('click', processLogoGenAll);
if (btnLogoDownloadAll) btnLogoDownloadAll.addEventListener('click', processLogoDownloadAll);
if (btnLogoResetAll) btnLogoResetAll.addEventListener('click', processLogoResetAll);
if (btnAddLogoSlot) {
    btnAddLogoSlot.addEventListener('click', () => {
        logoRemovalSlots.push(createEmptyLogoSlot());
        renderLogoRemovalSlots();
        setTimeout(() => logoRemovalGrid?.scrollTo({ top: logoRemovalGrid.scrollHeight, behavior: 'smooth' }), 100);
    });
}

// Global Toolbar Events
if (btnResetOverlay) {
    btnResetOverlay.addEventListener('click', () => {
        initOverlaySlots();
        renderOverlaySlots();
        showStatus('All slots reset.');
    });
}
if (btnToggleAllBg) {
    btnToggleAllBg.addEventListener('click', () => {
        // Toggle based on the first slot's state or default to true if mixed
        const allOn = overlaySlots.every(s => s.hasBackground);
        const newState = !allOn;
        
        overlaySlots.forEach(s => s.hasBackground = newState);
        renderOverlaySlots();
        showStatus(`All Backgrounds: ${newState ? 'ON' : 'OFF'}`);
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
        
        if (slotsToDownload.length === 1) {
            const slot = slotsToDownload[0];
            const a = document.createElement('a');
            a.href = slot.resultSrc!;
            const originalBase = slot.originalName ? slot.originalName.replace(/\.[^/.]+$/, "") : `Result_1`;
            a.download = `Overlay_${originalBase}.png`;
            a.click();
            return;
        }

        showStatus(`Preparing ZIP with ${slotsToDownload.length} images...`);
        const zip = new JSZip();
        for (let i = 0; i < slotsToDownload.length; i++) {
            const slot = slotsToDownload[i];
            const base64Data = slot.resultSrc!.split(',')[1];
            const originalBase = slot.originalName ? slot.originalName.replace(/\.[^/.]+$/, "") : `Result_${i + 1}`;
            zip.file(`Overlay_${originalBase}.png`, base64Data, { base64: true });
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Embedded_Images_Batch.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus("Download complete!");
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
        overlaySlots.forEach(s => s.isCollapsed = false);
    });
}
if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
        // Collapse All now works for any visible collapsible cards in the current tab
        const visibleContainer = document.querySelector('section.flex-1');
        if (visibleContainer) {
            visibleContainer.querySelectorAll('.collapsible-card').forEach(c => c.classList.add('card-collapsed'));
        }
        overlaySlots.forEach(s => s.isCollapsed = true);
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
// Removed multiviewResults reference
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
            sigColorBtns.forEach(b => b.classList.remove('active', 'ring-2', 'ring-offset-1', 'ring-offset-[#18181a]', 'ring-purple-500'));
            target.classList.add('active', 'ring-2', 'ring-offset-1', 'ring-offset-[#18181a]', 'ring-purple-500');
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
        logoDropZone.classList.add('border-purple-500', 'bg-gray-800');
    });
    logoDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDropZone.classList.remove('border-purple-500', 'bg-gray-800');
    });
    logoDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDropZone.classList.remove('border-purple-500', 'bg-gray-800');
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

// Logo Sliders
logoSizeSlider?.addEventListener('input', () => {
    globalLogoSize = parseInt(logoSizeSlider.value);
    setText(logoSizeVal, logoSizeSlider.value);
    renderOverlaySlots(); // Re-render to update
});
logoOpacitySlider?.addEventListener('input', () => {
    globalLogoOpacity = parseInt(logoOpacitySlider.value);
    setText(logoOpacityVal, logoOpacitySlider.value);
    renderOverlaySlots(); // Re-render to update
});
logoPositionSelect?.addEventListener('change', () => {
    globalLogoPosition = logoPositionSelect.value;
    renderOverlaySlots(); // Re-render to update
});

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
        wrapper.className = "relative group w-20 h-20 rounded-none overflow-hidden border border-gray-600 shrink-0";
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = "w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity";
        img.onclick = () => openModal(file, img.src);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = "absolute top-1 right-1 w-4 h-4 bg-gray-900/80 hover:bg-red-600 rounded-none-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10";
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
    
    if (activeTab === 'textOverlay') {
        // Handle multiple files for Text Overlay
        (async () => {
            for (const file of newFiles) {
                const emptyIndex = overlaySlots.findIndex(s => !s.file);
                if (emptyIndex !== -1) {
                    await handleSlotFile(emptyIndex, file);
                } else {
                    overlaySlots.push(createEmptySlot());
                    await handleSlotFile(overlaySlots.length - 1, file);
                }
            }
            renderOverlaySlots();
            showStatus(`Loaded ${newFiles.length} images into Text Overlay`);
        })();
        return;
    }

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
    dropZone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        removeClass(dropZone, 'drag-active'); 
        handleFiles(e.dataTransfer?.files || null); 
    });
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

if(sketchClearBtn) {
    sketchClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSketchFile = null;
        if(sketchPreviewImg) {
            sketchPreviewImg.src = '';
            addClass(sketchPreviewImg, 'hidden');
        }
        if(sketchEmptyState) removeClass(sketchEmptyState, 'hidden');
        addClass(sketchClearBtn, 'hidden');
        if(sketchInput) sketchInput.value = '';
    });
}


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

async function generateArtisticStyle(styleKey: string, styleName: string, stylePrompt: string, customRefFile: File | null = null) {
    if (currentFiles.length === 0) {
        showStatus(currentLang === 'en' ? 'Please upload images first.' : 'Vui lòng tải ảnh lên trước.', true);
        return;
    }
    setLoading(true);
    try {
        let prompt = `Role: Architectural Illustrator. 
        TASK: Generate a detailed prompt to convert the uploaded architectural project into a specific artistic style: "${styleName}".
        STYLE DESCRIPTION: ${stylePrompt}
        REQUIREMENTS:
        1. Preserve the architectural form, structure, and perspective of the uploaded images.
        2. Describe the artistic medium, line quality, shading techniques, and color palette in detail.
        3. Ensure the prompt is optimized for high-quality AI image generation.
        4. Output strictly valid JSON: { "en": "...", "vi": "..." }`;

        if (customRefFile) {
            prompt += `\nSTYLE REFERENCE: An additional image has been provided as a STYLE REFERENCE. Analyze its artistic style, medium, and mood, and apply these characteristics to the generated prompt.`;
        }

        const txt = await callGemini(prompt, currentFiles, customRefFile || currentSketchFile);
        const raw = extractJson(txt);
        artisticHistory.push({
            style: styleName,
            en: raw.en,
            vi: raw.vi
        });
        updateLanguageUI();
        showStatus('Generated!');
    } catch (e) {
        handleApiError(e, 'Error generating style');
    } finally {
        setLoading(false);
    }
}

// Custom Style Reference Handlers
if(dropZoneStyle) {
    dropZoneStyle.addEventListener('click', () => fileInputStyle?.click());
    dropZoneStyle.addEventListener('dragover', (e) => { e.preventDefault(); addClass(dropZoneStyle, 'border-purple-500'); });
    dropZoneStyle.addEventListener('dragleave', () => removeClass(dropZoneStyle, 'border-purple-500'));
    dropZoneStyle.addEventListener('drop', (e) => {
        e.preventDefault();
        removeClass(dropZoneStyle, 'border-purple-500');
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('image/')) handleStyleRefFile(file);
    });
}

if(fileInputStyle) fileInputStyle.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleStyleRefFile(file);
});

function handleStyleRefFile(file: File) {
    currentStyleRefFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        if(imgStyleRef) imgStyleRef.src = e.target?.result as string;
        setHidden(styleRefPreview, false);
        setHidden(styleRefPlaceholder, true);
        setHidden(btnClearStyleRef, false);
    };
    reader.readAsDataURL(file);
}

if(btnClearStyleRef) btnClearStyleRef.addEventListener('click', (e) => {
    e.stopPropagation();
    currentStyleRefFile = null;
    setHidden(styleRefPreview, true);
    setHidden(styleRefPlaceholder, false);
    setHidden(btnClearStyleRef, true);
    if(fileInputStyle) fileInputStyle.value = '';
});

if(btnGenerateCustomStyle) btnGenerateCustomStyle.addEventListener('click', () => {
    const customText = inputCustomStyle?.value.trim() || "Custom Artistic Style";
    generateArtisticStyle('custom', currentLang === 'en' ? 'Custom Style' : 'Phong cách tùy chỉnh', customText, currentStyleRefFile);
});

if(btnStyleWatercolor) btnStyleWatercolor.addEventListener('click', () => {
    const t = translations[currentLang].artisticStyles;
    generateArtisticStyle('watercolor', t.watercolor, "Watercolor architectural sketch, soft vibrant colors, bleeding edges, visible paper texture, hand-drawn pencil outlines, artistic and expressive.");
});
if(btnStyleBlueInk) btnStyleBlueInk.addEventListener('click', () => {
    const t = translations[currentLang].artisticStyles;
    generateArtisticStyle('blueInk', t.blueInk, "Architectural sketch using blue ballpoint pen on aged, stained paper. Cross-hatching, varying line weights, realistic ink texture, vintage feel.");
});
if(btnStyleCleanLine) btnStyleCleanLine.addEventListener('click', () => {
    const t = translations[currentLang].artisticStyles;
    generateArtisticStyle('cleanLine', t.cleanLine, "Clean architectural line art, minimalist blueprint style, thin black lines on a light blue background, soft white highlights, precise and modern.");
});
if(btnStyleBlackInk) btnStyleBlackInk.addEventListener('click', () => {
    const t = translations[currentLang].artisticStyles;
    generateArtisticStyle('blackInk', t.blackInk, "Technical architectural drawing, black ink on white paper, detailed cross-hatching, stippling for shadows, precise lines, professional drafting style.");
});
if(btnStyleRedInk) btnStyleRedInk.addEventListener('click', () => {
    const t = translations[currentLang].artisticStyles;
    generateArtisticStyle('redInk', t.redInk, "Architectural sketch in red ink, energetic lines, technical annotations and dimensions in red, hand-drawn on white paper, conceptual and dynamic.");
});

if(analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0 && !currentSketchFile) { showStatus('Please upload files.', true); return; }
        setLoading(true);
        try {
            const hasSketch = !!currentSketchFile;
            let prompt = `Role: Architectural Photographer & Prompt Engineer. 
            Analyze the provided images. 
            REALISM REQUIREMENT: Always include phrases like "Tạo ảnh siêu thực từ hình ảnh tải lên", "Ảnh chụp thực tế từ hình ảnh tải lên", or "Hình ảnh siêu thực của hình ảnh sketch tải lên" in the generated prompts.
            PHOTOREALISM: All generated prompts must describe photorealistic, high-quality, real-life images.
            DETAIL PRESERVATION: Ensure strict adherence to the visual details of the uploaded images.
            CONTEXTUAL CONSISTENCY: Maintain consistency with the surrounding environment (context) across different angles.
            EXTERIOR CONTEXT: If the project is an EXTERIOR, place it in a realistic setting such as a busy street, a quiet residential neighborhood, a coastal area with ocean views, or a serene riverside.
            INTERIOR CONTEXT: If the project is an INTERIOR, describe it as a fully finished, professionally designed, and high-end interior space.
            SPECIAL INSTRUCTION: If you detect any image that is a collage (multiple smaller views or angles combined into one main image), you MUST treat it as a single architectural project or space. 
            Analyze the relationship between these views to understand the project holistically. 
            Ensure the 'generationPrompt' captures the essence of the project while allowing for the specific details and camera angles seen in the collage to be preserved in future generations.
            Return JSON.`;
            if (hasSketch) {
                if (currentFiles.length > 0) {
                    prompt += ` 
                    SKETCH ANALYSIS: One of the provided images is a SKETCH. 
                    Your task is to create a 'sketchPrompt' that describes how to render this specific SKETCH into a photorealistic architectural visualization.
                    The 'sketchPrompt' MUST use the architectural style, materials, lighting, and context extracted from the other REFERENCE IMAGES.
                    Ensure the 'sketchPrompt' is detailed enough for an AI image generator to accurately interpret the sketch's lines while applying the reference DNA.`;
                } else {
                    prompt += `
                    SKETCH ANALYSIS: The provided image is a SKETCH.
                    Your task is to create a 'sketchPrompt' that describes how to render this specific SKETCH into a photorealistic architectural visualization.
                    Since no other reference images are provided, use your architectural knowledge to suggest a high-quality style, materials, and context that would suit the design in the sketch.`;
                }
            }
            prompt += ` JSON: { 
                "style": {"en":"", "vi":""}, 
                "materials": {"en":"", "vi":""}, 
                "lighting": {"en":"", "vi":""}, 
                "context": {"en":"", "vi":""}, 
                "composition": {"en":"", "vi":""}, 
                "generationPrompt": {"en":"", "vi":""},
                "collageAnalysis": {"en":"", "vi":""}
                ${hasSketch ? ', "sketchPrompt": {"en":"", "vi":""}':''} 
            }`;
            
            const txt = await callGemini(prompt, currentFiles, currentSketchFile);
            const newData = extractJson(txt);
            
            if (!lastAnalysisData) {
                lastAnalysisData = {
                    style: { en: "", vi: "" },
                    materials: { en: "", vi: "" },
                    lighting: { en: "", vi: "" },
                    context: { en: "", vi: "" },
                    composition: { en: "", vi: "" },
                    generationPrompt: { en: "", vi: "" }
                };
            }

            // Merge new data into bilingual structure
            const keys = ['style', 'materials', 'lighting', 'context', 'composition', 'generationPrompt', 'collageAnalysis', 'sketchPrompt'];
            keys.forEach(k => {
                if (newData[k]) {
                    lastAnalysisData![k] = newData[k];
                }
            });

            updateLanguageUI(); 
            showStatus('');
        } catch(e) { handleApiError(e, 'Error analyzing'); } finally { setLoading(false); }
    });
}

const analyzeImagePromptBtn = getEl<HTMLButtonElement>('analyze-image-prompt-btn');
const btnAnalyzeImagePromptText = getEl('btn-analyze-image-prompt-text');

// ... (later in the file)

if(analyzeImagePromptBtn) {
    analyzeImagePromptBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0) { showStatus('Please upload files.', true); return; }
        setLoading(true);
        try {
            const lang = currentLang === 'vi' ? 'VIETNAMESE' : 'ENGLISH';
            const prompt = `
                Role: Senior Architectural Technical Analyst.
                Task: Analyze the provided images and provide a detailed architectural analysis in ${lang}.
                Focus on:
                1. Architectural Style & Form.
                2. Material Palette & Textures.
                3. Key Distinctive Features.
                4. Lighting & Atmosphere.
                5. Context & Environment.
                6. Composition & Camera.
                7. Generation Prompt: Provide a detailed prompt for AI image generation based on this analysis.
                
                Output strictly valid JSON:
                {
                    "style": "...",
                    "materials": "...",
                    "lighting": "...",
                    "context": "...",
                    "composition": "...",
                    "generationPrompt": "..."
                }
            `;
            const txt = await callGemini(prompt, currentFiles, null);
            const data = extractJson(txt);
            
            if (!lastAnalysisData) {
                lastAnalysisData = {
                    style: { en: "", vi: "" },
                    materials: { en: "", vi: "" },
                    lighting: { en: "", vi: "" },
                    context: { en: "", vi: "" },
                    composition: { en: "", vi: "" },
                    generationPrompt: { en: "", vi: "" }
                };
            }

            // Merge strings into current language in bilingual structure
            const keys = ['style', 'materials', 'lighting', 'context', 'composition', 'generationPrompt'];
            keys.forEach(k => {
                if (data[k]) {
                    if (!lastAnalysisData![k]) lastAnalysisData![k] = { en: "", vi: "" };
                    lastAnalysisData![k][currentLang] = data[k];
                }
            });
            
            updateLanguageUI();
            showStatus(currentLang === 'en' ? 'Analysis complete!' : 'Phân tích hoàn tất!');
        } catch(e) { handleApiError(e, 'Error analyzing'); } finally { setLoading(false); }
    });
}

// --- Multi-View Logic ---

if (btnAnalyzeMultiView) {
    btnAnalyzeMultiView.addEventListener('click', async () => {
        if (currentFiles.length === 0) {
            showStatus(currentLang === 'en' ? 'Please upload images first.' : 'Vui lòng tải ảnh lên trước.', true);
            return;
        }

        try {
            setLoading(true);
            const langName = currentLang === 'en' ? 'English' : 'Vietnamese';
            const prompt = `
                Role: Principal Architectural Technical Analyst & Prompt Engineer.
                Task: Perform a deep "Reconstructive Analysis" of the uploaded images to establish a definitive "Visual DNA" for this project.
                
                ANALYSIS CATEGORIES:
                1. ARCHITECTURAL STYLE & VOLUME: Identify the specific style (e.g., Brutalist, Contemporary Minimalist, Indochine, Tropical Modernism). Describe the massing, geometric complexity, and structural logic.
                2. FACADE & TEXTURES: Break down the external skin. Specify materials (e.g., board-formed concrete, burnt cedar, low-E glass with black aluminum frames, travertine stone). Note the wear, reflectivity, and grain.
                3. UNIQUE ARCHITECTURAL FEATURES: Identify identifying markers (e.g., cantilevered balconies, specific trellis patterns, circular windows, recessed entrances).
                4. LIGHTING & ENVIRONMENT: Describe the exact lighting condition and the surrounding context (e.g., urban density, coastal vegetation, specific street furniture).
                5. COLOR PALETTE: Define the primary and accent colors with precise descriptors.

                REALISM & SYNC REQUIREMENTS:
                - Always include phrases like "Tạo ảnh siêu thực từ hình ảnh tải lên", "Ảnh chụp thực tế từ hình ảnh tải lên", or "Hình ảnh siêu thực của hình ảnh sketch tải lên" in your summary.
                - The description MUST be of professional "Master Class" quality, suitable for high-end rendering prompts.
                - If the image is a collage, analyze the 3D relationship between the views to identify it as a single building.

                Goal: Create a MASTER REFERENCE established in ${langName} and English that captures every significant detail. This DNA will be used to generate consistent multi-angle visualizations.

                Output strictly valid JSON:
                {
                    "en": "EXHAUSTIVE MASTER DNA IN ENGLISH (Include all categories)...",
                    "vi": "DNA DỰ ÁN CHI TIẾT BẰNG TIẾNG VIỆT (Bao gồm đầy đủ các hạng mục phân tích)..."
                }
            `;

            const responseText = await callGemini(prompt, currentFiles, currentSketchFile);
            const data = extractJson(responseText);
            
            if (!lastAnalysisData) {
                lastAnalysisData = {
                    style: { en: "", vi: "" },
                    materials: { en: "", vi: "" },
                    lighting: { en: "", vi: "" },
                    context: { en: "", vi: "" },
                    composition: { en: "", vi: "" },
                    generationPrompt: { en: "", vi: "" }
                };
            }
            lastAnalysisData.collageAnalysis = data;
            
            updateLanguageUI();
            showStatus(currentLang === 'en' ? 'Object DNA established!' : 'Đã thiết lập DNA Project!');
        } catch(e) { 
            handleApiError(e, 'Error established DNA'); 
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
            // Process images concurrently via server proxy
            const promises = currentFiles.map(async (file) => {
                const parts = [
                    await processFileForGemini(file),
                    { text: "Analyze the handwritten or printed notes/text on this architectural image. Transcribe all text strictly into Vietnamese (if it's not already VI, translate it to VI). Also provide a professional English translation. Return ONLY a valid JSON object with 'vi' and 'en' keys. Do not include any other text or markdown formatting outside the JSON." }
                ];
                
                try {
                    const data = await generateContentWithRetry({
                        model: currentModel,
                        contents: { parts: parts },
                        generationConfig: { responseMimeType: "application/json" }
                    });
                    const txt = data.text || "{}";
                    const json = extractJson(txt);
                    return { file: file, vi: json.vi || "No text detected", en: json.en || "No text detected" };
                } catch (e) {
                    console.error("Single image error:", e);
                    return { file: file, vi: "Error processing: " + (e instanceof Error ? e.message : String(e)), en: "Error processing" };
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


if (btnAnalyzeMultiViewGen) {
    btnAnalyzeMultiViewGen.addEventListener('click', async () => {
        if (!lastAnalysisData || !lastAnalysisData.collageAnalysis) {
            showStatus(currentLang === 'en' ? 'Phase 1: Object DNA must be established first.' : 'Giai đoạn 1: Cần thiết lập DNA Project trước.', true);
            return;
        }

        try {
            setLoading(true);
            const totalCount = parseInt(angleCountInput?.value || "10", 10);
            const dnaEn = lastAnalysisData.collageAnalysis.en;
            const dnaVi = lastAnalysisData.collageAnalysis.vi;
            
            // Optimization: Parallel generation (Bandwidth check: Use text-only because DNA is established)
            // Divide into chunks of 2-3 to manage token limits and speed
            const batchSize = 2; // 2 angles per call
            const numBatches = Math.ceil(totalCount / batchSize);
            const promises = [];

            for (let i = 0; i < numBatches; i++) {
                const countThisBatch = Math.min(batchSize, totalCount - i * batchSize);
                const prompt = `
                    Role: Master Architectural Visualization Architect.
                    DNA REFS: (EN: ${dnaEn}), (VI: ${dnaVi})
                    Task: Generate ${countThisBatch} distinct high-end architectural visualization prompts.
                    
                    RULES:
                    - Absolute sync with DNA.
                    - Start each strictly with: "Tạo ảnh siêu thực từ hình ảnh tải lên", "Ảnh chụp thực tế từ hình ảnh tải lên", or "Hình ảnh siêu thực của hình ảnh sketch tải lên".
                    - Provide 3 sections: [CONTENT], [COMPOSITION], [LIGHTING].
                    
                    Output format:
                    ===ANGLE: [Name]
                    [CONTENT]: ...
                    [COMPOSITION]: ...
                    [LIGHTING]: ...

                    Return exactly ${countThisBatch} angles in valid JSON: {"en": "...", "vi": "..."}
                `;
                // Text-only call is significantly faster and saves bandwidth
                promises.push(callGemini(prompt, [], null));
            }

            const results = await Promise.all(promises);
            let finalEn = "";
            let finalVi = "";

            results.forEach(txt => {
                const data = extractJson(txt);
                if (data.en) finalEn += "\n" + data.en;
                if (data.vi) finalVi += "\n" + data.vi;
            });

            if (lastAnalysisData) {
                lastAnalysisData.multiViewPrompts = { en: finalEn.trim(), vi: finalVi.trim() };
                updateLanguageUI();
                showStatus(currentLang === 'en' ? 'Multi-View Generation Fast & Complete!' : 'Đã tăng tốc tạo đa góc nhìn xong!');
            }
        } catch (e) {
            handleApiError(e, 'Error in accelerated multi-view generation');
        } finally {
            setLoading(false);
        }
    });
}

if (btnGenerateCustomAngle) {
    btnGenerateCustomAngle.addEventListener('click', async () => {
        const req = customAngleInput?.value.trim();
        if (!req) return;
        if (!lastAnalysisData || !lastAnalysisData.collageAnalysis) {
             showStatus(currentLang === 'en' ? 'Object DNA must be established first.' : 'Cần thiết lập DNA Project trước.', true);
             return;
        }

        try {
            setLoading(true);
            const dna = lastAnalysisData.collageAnalysis.en;
            const prompt = `
                Role: Master Architectural Photographer.
                Task: Generate a single, ultra-detailed architectural prompt for a custom angle: "${req}".
                
                DNA REFERENCE: ${dna}
                
                REQUIREMENTS:
                1. STRICT ADHERENCE: Use the materials, style, and features from the DNA.
                2. RICH DESCRIPTION: Provide a cinematic, highly descriptive prose. Describe textures, reflections, and structural details.
                3. REALISM: Start with "Tạo ảnh siêu thực từ hình ảnh tải lên", "Ảnh chụp thực tế từ hình ảnh tải lên", or "Hình ảnh siêu thực của hình ảnh sketch tải lên".
                4. CAMERA & LIGHTING: Specify a professional camera setup and cinematic lighting that enhances the details.

                Output JSON: 
                { 
                  "en": { "title": "Custom Angle - ${req}", "content": "...", "composition": "...", "lighting": "..." }, 
                  "vi": { "title": "Góc Tùy Chỉnh - ${req}", "content": "...", "composition": "...", "lighting": "..." } 
                }
            `;
            const txt = await callGemini(prompt, currentFiles, currentSketchFile);
            const raw = extractJson(txt);
            customAnglesHistory.push({ en: raw.en, vi: raw.vi });
            updateLanguageUI(); 
            showStatus(currentLang === 'en' ? 'Custom Angle Generated!' : 'Góc tùy chỉnh đã được tạo!');
            if (customAngleInput) customAngleInput.value = '';
        } catch(e) { 
            handleApiError(e, 'Error generating custom angle'); 
        } finally { 
            setLoading(false); 
        }
    });
}

if (btnDownloadAllMultiView) {
    btnDownloadAllMultiView.addEventListener('click', async () => {
        const cards = multiviewGrid?.querySelectorAll('.card-content');
        if (!cards || cards.length === 0) {
            showStatus('No angles to download.', true);
            return;
        }

        try {
            const zip = new JSZip();
            const rootFolder = zip.folder("MultiView_Prototypes");
            
            const cardWrappers = multiviewGrid?.querySelectorAll('.collapsible-card');
            cardWrappers?.forEach((card, idx) => {
                const title = (card.querySelector('h3')?.textContent || `Angle_${idx}`).replace(/\s+/g, '_');
                const content = card.querySelector('.card-content p')?.textContent || "";
                if (content && rootFolder) {
                    rootFolder.file(`${title}.txt`, content);
                }
            });

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `MultiView_Prototypes_${new Date().getTime()}.zip`;
            link.click();
            showStatus('Downloading ZIP...');
        } catch (e) {
            console.error("ZIP Error:", e);
            showStatus('ZIP Generation Failed', true);
        }
    });
}

// Single Run Buttons (Reset/Re-run)
const runSingle = async (key: keyof AnalysisResult) => {
    if(currentFiles.length === 0 && !currentSketchFile) {
        showStatus('Please upload an image first', true);
        return;
    }
    setLoading(true);
    try {
        let prompt = `Analyze ONLY: ${String(key)}. 
        REALISM: Always include phrases like "Tạo ảnh siêu thực từ hình ảnh tải lên", "Ảnh chụp thực tế từ hình ảnh tải lên", or "Hình ảnh siêu thực của hình ảnh sketch tải lên" in the response.
        PHOTOREALISM: The response must describe a photorealistic, high-quality real-life image.
        DETAIL PRESERVATION: Ensure strict adherence to the visual details of the uploaded images.
        CONTEXTUAL CONSISTENCY: Maintain consistency with the surrounding environment (context) across different angles.
        CONTEXT: If exterior, use realistic settings (street, residential, coast, river). If interior, focus on finished spaces.`;

        if (key === 'sketchPrompt') {
            prompt += `
            TASK: Create a prompt to render the provided SKETCH into a photorealistic image.
            If REFERENCE IMAGES are provided, use their style/materials/context.
            If no references are provided, suggest a high-quality architectural style.`;
        }
        
        if (key === 'photoToSketchPrompt') {
            prompt = `Role: Architectural Sketch Artist.
            TASK: Create a detailed prompt to convert the uploaded PHOTOGRAPH into a hand-drawn architectural sketch.
            STRICT REQUIREMENT: 
            1. DO NOT mention lighting, photorealism, or realistic rendering.
            2. Focus on: Line quality (pencil, ink, charcoal), hatching techniques, paper texture, and artistic expression.
            3. Describe the scene as a pure drawing or sketch.
            4. Preserve the architectural form and perspective of the photo.
            Return JSON: { "photoToSketchPrompt": { "en": "...", "vi": "..." } }`;
        }

        prompt += ` Return JSON: { "${String(key)}": { "en": "...", "vi": "..." } }`;
        const txt = await callGemini(prompt, currentFiles, currentSketchFile);
        const raw = extractJson(txt);
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
if(btnToSketchPrompt) btnToSketchPrompt.addEventListener('click', (e) => { e.stopPropagation(); runSingle('photoToSketchPrompt'); });

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
                const success = await copyToClipboard(text, copyBtn, iconCheck, iconCopy);
                if (success) {
                    showStatus('Copied to clipboard!');
                    setTimeout(() => showStatus(''), 2000);
                } else {
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
setupCardActions('res-photo-to-sketch', 'btn-copy-photo-to-sketch', 'btn-dl-photo-to-sketch', 'Photo_to_Sketch_Prompt');
setupCardActions('res-collage-analysis', 'btn-copy-collage-analysis', 'btn-dl-collage-analysis', 'Collage_Analysis');
setupCardActions('res-mv-dna', 'btn-copy-mv-dna', '', 'Multi_View_DNA');

// PNG Info Button Logic
if (btnPngInfoPrompt) {
    btnPngInfoPrompt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!lastAnalysisData) {
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
            style: getEnText(resStyle, 'style'),
            materials: getEnText(resMaterial, 'materials'),
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
                        
                        const filename = `BananaPro_Info_${carrierFile.name.split('.')[0]}.png`;
                        await saveBlob(finalBlob, filename);
                        
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
        if (!lastAnalysisData) {
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
            style: getEnText(resStyle, 'style'),
            materials: getEnText(resMaterial, 'materials'),
            inpaint: "",
            inpaintEnabled: false,
            cameraProjection: false
        };
        const success = await copyToClipboard(JSON.stringify(bananaData, null, 2));
        if (success) {
            showStatus('Copied Data JSON!');
        } else {
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
        if (lastAnalysisData.collageAnalysis?.[currentLang]) content += `=== ${t.titles.collageAnalysis} ===\n${lastAnalysisData.collageAnalysis[currentLang]}\n\n`;

        triggerDownload(content, 'Full_Architectural_Analysis.txt');
    });
}

// Copy All Button
const copyAllBtn = getEl<HTMLButtonElement>('copy-all-btn');
if (copyAllBtn) {
    copyAllBtn.addEventListener('click', async () => {
        if (!lastAnalysisData) {
            showStatus('No analysis data to copy', true);
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
        if (lastAnalysisData.collageAnalysis?.[currentLang]) content += `=== ${t.titles.collageAnalysis} ===\n${lastAnalysisData.collageAnalysis[currentLang]}\n\n`;

        const success = await copyToClipboard(content, copyAllBtn, iconCheckAll, iconCopyAll);
        if (success) showStatus('Analysis copied to clipboard!');
        else showStatus('Failed to copy to clipboard', true);
    });
}

// "Select Folder" -> Choose a directory for direct downloads
if (btnSelectFolder) {
    // Hide button if browser doesn't support the API at all
    if (!('showDirectoryPicker' in window)) {
        btnSelectFolder.style.opacity = '0.3';
        btnSelectFolder.title = 'Folder selection not supported by this browser';
    }

    btnSelectFolder.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Check if we are in an iframe
        const isInIframe = window.self !== window.top;
        
        try {
            if (isInIframe) {
                showStatus('Security: Open in a new tab to use folder selection.', true);
                console.warn("showDirectoryPicker is blocked in cross-origin iframes. Open the app in a new tab.");
                return;
            }

            // @ts-ignore
            downloadDirectoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            showStatus('Download folder selected!');
        } catch (err: any) {
            console.error("Folder selection failed", err);
            if (err.name === 'SecurityError' || err.message.includes('frames')) {
                showStatus('Security Error: Open in a new tab to use this feature.', true);
            } else if (err.name !== 'AbortError') {
                showStatus('Folder selection failed', true);
            }
        }
    });
}

// Init Setup Call
setupCollapsibleCards();
updateLanguageUI();
updateApiUI();