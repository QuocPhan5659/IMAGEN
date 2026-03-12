import { ViewDefinition, AspectRatio } from './types';

export const COMMON_CONSTRAINT = "STRICT ARCHITECTURAL CONSTRAINTS: KEEP THE GEOMETRY REALISTIC AND BELIEVABLE. DO NOT REDESIGN THE BUILDING. Maintain the exact structural proportions, materials, and architectural style of the provided reference image(s). Correct vertical perspective, no distortion. No structural modifications. No hallucinations of non-existent styles.";

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Cinematic' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '3:4', label: '3:4 Vertical' },
  { value: '3:2', label: '3:2 Landscape' },
  { value: '2:3', label: '2:3 Portrait' },
  { value: 'random', label: 'Random Output' },
];

export const VIEWS: ViewDefinition[] = [
  {
    id: 1,
    titleVI: "Ảnh Tranh Vẽ",
    titleEN: "Architectural Illustration",
    description: "Vẽ tay kỹ thuật số (Digital hand-drawn style).",
    prompt: `Architectural illustration style, clean digital hand-drawn, flat colors, clear outlines, minimal shading, simplified materials, no photorealism, keep original perspective and composition. Structure and geometry must match the reference.`
  },
  {
    id: 2,
    titleVI: "View Nghiêng 3/4 Trái",
    titleEN: "Left 3/4 View",
    description: "Thấy hông trái và cây xanh (Left façade & greenery).",
    prompt: `Based on the reference image(s), create a Left 3/4 View (oblique perspective from the left). Maintain the structure of the floors and the position of the greenery strictly. Capture the full depth of the left flank of the building. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 3,
    titleVI: "View Nghiêng 3/4 Phải",
    titleEN: "Right 3/4 View",
    description: "Thấy hông phải và vật liệu (Right façade & details).",
    prompt: `Based on the reference image(s), create a Right 3/4 View (oblique perspective from the right). Ensure that the stone material details and the glass window systems are completely synchronized and consistent with the reference image. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 4,
    titleVI: "Góc Mặt Đứng Chính",
    titleEN: "Frontal View",
    description: "Trung tính, chuẩn hồ sơ (Neutral, professional profile).",
    prompt: `Simulate a frontal architectural photograph based on the reference image(s). Camera placed at human eye level, centered in front of the building, shot with a 35mm lens. Balanced composition, straight vertical lines, soft natural lighting. Realistic architectural photography, professional documentation style. ${COMMON_CONSTRAINT}`
  },
  {
    id: 14,
    titleVI: "Góc Mặt Đứng Bên",
    titleEN: "Side Elevation",
    description: "Chiều sâu, chi tiết mặt hông (Side details, depth).",
    prompt: `Based on the reference image(s), create a Side Elevation view. Shoot straight into the side of the building, maintaining consistency in ground floor materials and window systems extending from the front to the side. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 5,
    titleVI: "View Chụp Cảnh Đêm",
    titleEN: "Night / Blue Hour View",
    description: "Giờ xanh, lên đèn ấm áp (Blue hour, warm lighting).",
    prompt: `Using the reference image(s), generate a realistic night architectural photograph captured during Blue Hour. Subject: The building glowing with warm yellow lights (3000K) shining through windows. Details: Accent lighting highlighting the building's warmth. Atmosphere: Cozy, inviting, contrast between warm house and deep blue evening sky. Reflections on glass windows. ${COMMON_CONSTRAINT}`
  },
  {
    id: 6,
    titleVI: "View Chụp Chạng Vạng",
    titleEN: "Twilight View",
    description: "Góc thấp, sang trọng (Low angle, luxurious).",
    prompt: `Using the reference image(s), generate a low-angle architectural photograph of the facade. Composition: Foreground foliage on the right blurred to increase depth. Atmosphere: Twilight / blue hour, slightly cloudy sky, luxurious and quiet feeling. High resolution, architectural visualization style. ${COMMON_CONSTRAINT}`
  },
  {
    id: 7,
    titleVI: "View Ánh Sáng Chiều Vàng",
    titleEN: "Golden Hour View",
    description: "Ánh sáng nghệ thuật, hắt bóng cây (Artistic golden hour).",
    prompt: `Using the reference image(s), simulate a professional architectural photograph captured during the golden hour. Subject: The main house is clearly highlighted with artistic warm light accents to emphasize its architectural form. Lighting: Soft, warm afternoon sun casting long, elegant shadows of nearby trees across the green grass and the building facade. Atmosphere: Serene and artistic, enhancing the visual depth of the house. Highly realistic architectural photography, correct vertical lines, same building, same materials. ${COMMON_CONSTRAINT}`
  },
  {
    id: 8,
    titleVI: "View Chụp Buổi Trưa",
    titleEN: "Noon View",
    description: "Nắng gắt, tương phản cao (High contrast, sharp shadows).",
    prompt: `Simulate a noon architectural photograph. Lighting: Harsh, vertical sunlight creating sharp, defined shadows and high contrast. Sky: Deep, saturated blue sky (polarized filter effect). Atmosphere: Bright, clear, vibrant. Ensure architectural details are distinct. ${COMMON_CONSTRAINT}`
  },
  {
    id: 9,
    titleVI: "View 3/4 Từ Trên Cao",
    titleEN: "High-angle 3/4 Right",
    description: "Từ ban công đối diện (From opposite balcony).",
    prompt: `Create a High-angle 3/4 View from the right side, as if taken from the balcony of an opposite building. Look down to clearly show the connection between the roof structure and the greenery system on the balconies. Highly realistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 10,
    titleVI: "View 3/4 Từ Góc Thấp",
    titleEN: "Low-angle 3/4 Left",
    description: "Góc thấp uy nghi, giữ cổng rào (Majestic low angle, fence details).",
    prompt: `Create a Low-angle 3/4 View from the left. Position the camera low on the sidewalk looking up to make the building appear majestic and tall. Strictly maintain the details of the fence and main gate. Highly realistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 11,
    titleVI: "View 3/4 Góc Rộng",
    titleEN: "Wide-angle 3/4 View",
    description: "Bối cảnh đường phố (Street context).",
    prompt: `Create a Wide-angle 3/4 View. Move the camera back to reveal the surrounding Vietnamese street context (sidewalks, adjacent atmosphere) while keeping the building as the focal point with synchronized details. Highly realistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 12,
    titleVI: "View Cận Cảnh Góc Nghiêng",
    titleEN: "Medium 3/4 Shot",
    description: "Tập trung tầng 2 & mảng xanh (Focus on upper floors).",
    prompt: `Create a Medium 3/4 Shot. Focus tightly on the architectural massing from the 2nd floor upwards to detail the window systems and balcony greenery. Exclude the ground floor gate to focus on the upper architectural details. Highly realistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 13,
    titleVI: "Góc Chính Diện Kỹ Thuật",
    titleEN: "Orthographic Front Elevation",
    description: "Tỷ lệ chuẩn, đường thẳng đứng (Vertical lines, tilt-shift).",
    prompt: `Based on the reference image(s), create a Front Elevation view (Orthographic/Flat View). Ensure architectural lines are absolutely vertical (Tilt-shift technique), clearly showing symmetry and the exact position of greenery as in the reference. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 15,
    titleVI: "Góc Chính Diện Từ Dưới",
    titleEN: "Worm’s-eye Front View",
    description: "Góc thấp từ vỉa hè, uy nghi (Majestic low angle).",
    prompt: `Create a Worm’s-eye Front View (looking up from the front). Place the camera low near the ground at the sidewalk, using a wide focal length effect to make the building look majestic and impressive, while strictly maintaining correct balcony details and high-floor greenery. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 16,
    titleVI: "Góc Chính Diện Từ Trên",
    titleEN: "High-angle Front View",
    description: "Từ nhà đối diện nhìn sang (From opposite building).",
    prompt: `Create a High-angle Front View (looking down from the front). Place the camera at the 4th-5th floor level of the opposite building looking straight over, clearly showing the roof structure, terrace planters, and the connection between the lower floors. Highly realistic architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 17,
    titleVI: "Góc Chim Bay Từ Phía Trước",
    titleEN: "Aerial Bird's Eye Front",
    description: "Bao quát toàn bộ hình khối mái (Roof & overall massing).",
    prompt: `Based on the reference image(s), create an Aerial Bird's Eye View from the front. Look down from high above to encompass the entire roof massing, terrace spaces, and how the structure connects with the street frontage. Highly realistic architectural visualization. ${COMMON_CONSTRAINT}`
  },
  {
    id: 18,
    titleVI: "Góc Chim Bay 3/4",
    titleEN: "Aerial 3/4 View",
    description: "Thể hiện mặt tiền và chiều sâu (Facade & depth from above).",
    prompt: `Create an Aerial 3/4 View from above. This angle must showcase both the facade and the depth of the building, including all architectural layering and the greenery system from lower to upper floors. Highly realistic architectural visualization. ${COMMON_CONSTRAINT}`
  },
  {
    id: 19,
    titleVI: "Cận Cảnh Vật Liệu",
    titleEN: "Material Detail Shot",
    description: "Focus vào kết cấu độc đáo (Focus on unique textures).",
    prompt: `Create a Material Detail Shot. Focus the lens on the most unique textured material on the building facade. Use grazing light (side lighting) to highlight the material surface and texture. Photorealistic close-up. ${COMMON_CONSTRAINT}`
  },
  {
    id: 20,
    titleVI: "Cận Cảnh Mảng Xanh",
    titleEN: "Botanical Detail Shot",
    description: "Focus vào cây xanh ban công (Focus on balcony greenery).",
    prompt: `Create a Botanical Detail Shot. Focus on the most prominent greenery cluster at the balcony or main gate area. Use a Depth of Field (bokeh) effect to create a lush, artistic green feel. Photorealistic close-up. ${COMMON_CONSTRAINT}`
  },
  {
    id: 21,
    titleVI: "Cận Cảnh Giao Điểm",
    titleEN: "Architectural Junction Shot",
    description: "Điểm giao khối và vật liệu (Junction of forms & materials).",
    prompt: `Create an Architectural Junction Shot. Close-up on the intersection between geometric volumes or between two different materials to demonstrate the structural sophistication of the building. Photorealistic architectural detail. ${COMMON_CONSTRAINT}`
  },
  {
    id: 22,
    titleVI: "Chi Tiết Bóng Đổ",
    titleEN: "Shadow & Pattern Detail",
    description: "Hiệu ứng ánh sáng qua lam/cây (Light & shadow patterns).",
    prompt: `Create a Shadow & Pattern Detail view. Focus on how light penetrates through louvers, railings, or tree canopies to form shadow patterns on the building's wall surfaces. High contrast, artistic lighting. ${COMMON_CONSTRAINT}`
  },
  {
    id: 23,
    titleVI: "Góc Nhìn Từ Ban Công",
    titleEN: "POV from Balcony",
    description: "Từ trong nhìn ra (View from inside out).",
    prompt: `Create a POV from Balcony view. Position the camera from inside a balcony looking out, seeing part of the building's railing and greenery in the foreground, with the street context in the distance. Immersive perspective. ${COMMON_CONSTRAINT}`
  },
  {
    id: 24,
    titleVI: "Chi Tiết Ánh Sáng & Bóng Đổ Động",
    titleEN: "Dynamic Light & Shadow",
    description: "Mảng sáng tối ấn tượng qua lam/cửa (Dramatic interplay of light and shadow).",
    prompt: `Create a Dynamic Light & Shadow Detail view. Focus on how afternoon sun (or early morning light) slants through louvers or window frames, creating impressive and dynamic patterns of light and dark on the architectural surface. High contrast, artistic composition. ${COMMON_CONSTRAINT}`
  },
  {
    id: 25,
    titleVI: "Chi Tiết Phản Chiếu Nước",
    titleEN: "Water Reflection Detail",
    description: "Phản chiếu kiến trúc lên mặt nước/kính (Reflection on water/glass).",
    prompt: `Create a Water Reflection Detail view. If there is a water feature or large reflective surface (glass) near the building, capture a close-up of the architecture reflecting onto that surface, creating a unique visual effect. If no water exists in reference, simulate a puddle or glass reflection. ${COMMON_CONSTRAINT}`
  },
  {
    id: 26,
    titleVI: "Chi Tiết Đường Nét & Kết Cấu",
    titleEN: "Line & Texture Focus",
    description: "Giao nhau đường nét và vật liệu (Intersection of lines & textures).",
    prompt: `Create an Architectural Line & Texture Focus view. Close-up on the intersection of vertical and horizontal lines on the facade, along with the surface texture of main materials. Minimize distractions. Minimalist architectural photography. ${COMMON_CONSTRAINT}`
  },
  {
    id: 27,
    titleVI: "Chi Tiết Thang Bộ/Thang Máy",
    titleEN: "Staircase/Elevator Detail",
    description: "Cận cảnh thang ngoài trời (Outdoor staircase/elevator close-up).",
    prompt: `Create a Staircase/Elevator Detail view. If the building has an outdoor staircase or elevator visible in the reference, capture a close-up highlighting its materials and structure. If not present, focus on the vertical circulation element or main structural column. ${COMMON_CONSTRAINT}`
  },
  {
    id: 28,
    titleVI: "Từ Trong Nhìn Ra Ban Công",
    titleEN: "Interior-to-Balcony POV",
    description: "Khung cảnh qua cửa lớn (View through large door).",
    prompt: `Create an Interior-to-Balcony Perspective view. Shoot from an interior position, through a large door frame, looking out at the balcony. Include a small part of the interior as foreground, with the balcony and outside scenery as background, maintaining correct balcony structure. ${COMMON_CONSTRAINT}`
  },
  {
    id: 29,
    titleVI: "Từ Ban Công Nhìn Xuống",
    titleEN: "Balcony Downward View",
    description: "Khoe sân vườn/sân trước (Showcasing front yard/garden).",
    prompt: `Create a Balcony Downward View. Shoot from the top floor balcony, pointing the lens down towards the front yard or garden below. Clarify how the building integrates with the green space and entrance. ${COMMON_CONSTRAINT}`
  },
  {
    id: 30,
    titleVI: "Từ Mái Nhìn Xuống Cổng",
    titleEN: "Rooftop Gate View",
    description: "Bố cục lối vào từ trên cao (Entrance layout from above).",
    prompt: `Create a Rooftop Gate View. Place the camera high (from the roof or highest floor) looking straight down at the main gate and entrance area. Show the overall layout of the entry zone, including the fence and pathway. ${COMMON_CONSTRAINT}`
  },
  {
    id: 31,
    titleVI: "Cửa Sổ Khung Tranh",
    titleEN: "Framed Window View",
    description: "Khung cửa sổ như tranh (Window as a picture frame).",
    prompt: `Create a Framed Window View. Shoot from inside a room, through a window frame. The window acts as a 'picture frame' surrounding the outside scene (e.g., street, opposite trees). Include a small part of the window frame as foreground to create depth. ${COMMON_CONSTRAINT}`
  },
  {
    id: 32,
    titleVI: "View Xuyên Qua Tán Lá",
    titleEN: "Peeping Through Foliage",
    description: "Khung tranh tự nhiên từ cây (Natural framing with leaves).",
    prompt: `Create a Peeping Through Foliage view. Use tree branches or leaves in the foreground to partially obscure the lens, creating a 'natural picture frame' effect looking through to the building. Maintain the architectural details and greenery of the reference image behind the foliage layer. Natural and rustic feel. ${COMMON_CONSTRAINT}`
  },
  {
    id: 33,
    titleVI: "Cận Cảnh Sân Thượng",
    titleEN: "Rooftop Terrace Detail",
    description: "Chi tiết giàn lam, cây xanh mái (Pergola & rooftop plants).",
    prompt: `Create a Rooftop Terrace Detail view. Focus closely on the highest terrace or balcony area. Clearly show the pergola structure, rooftop greenery system, and railing details, ensuring complete synchronization with the design style of the original image. ${COMMON_CONSTRAINT}`
  }
];

export const SPECIAL_VIEWS: ViewDefinition[] = [
  {
    id: 34,
    titleVI: "VIEW COLLAGE 1",
    titleEN: "Artistic 5-Angle Collage 1",
    description: "Bố cục 5 ảnh trên nền đen xám (5-View Grid layout, dark background).",
    prompt: `Dựa vào ảnh tải lên làm tham chiếu, Tạo ra 5 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm:
    MANDATORY COMPOSITION: You MUST arrange the 5 views in a specific grid layout on a solid DARK background (#121212).
    - Top Row: 2 equal-sized square/rectangular views (View 1, View 2).
    - Middle Row: 2 equal-sized square/rectangular views (View 3, View 4).
    - Bottom Row: 1 large horizontal panoramic view spanning the full width of the two columns above (View 5).
    The 5 views must be perfectly synchronized in style, materials, and lighting.
    Style: Professional architectural photography, consistent lighting and materials across all views. High detailed, photorealistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 35,
    titleVI: "VIEW COLLAGE 2",
    titleEN: "Artistic 5-Angle Collage 2",
    description: "Bố cục 5 ảnh trên nền đen xám (5-View Grid layout, dark background).",
    prompt: `Dựa vào ảnh tải lên làm tham chiếu, Tạo ra 5 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm:
    MANDATORY COMPOSITION: You MUST arrange the 5 views in a specific grid layout on a solid DARK background (#121212).
    - Top Row: 2 equal-sized square/rectangular views (View 1, View 2).
    - Middle Row: 2 equal-sized square/rectangular views (View 3, View 4).
    - Bottom Row: 1 large horizontal panoramic view spanning the full width of the two columns above (View 5).
    The 5 views must be perfectly synchronized in style, materials, and lighting.
    Style: Professional architectural photography, consistent lighting and materials across all views. High detailed, photorealistic. ${COMMON_CONSTRAINT}`
  },
  {
    id: 36,
    titleVI: "VIEW COLLAGE 3",
    titleEN: "Artistic 5-Angle Collage 3",
    description: "Bố cục 5 ảnh trên nền đen xám (5-View Grid layout, dark background).",
    prompt: `Dựa vào ảnh tải lên làm tham chiếu, Tạo ra 5 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm:
    MANDATORY COMPOSITION: You MUST arrange the 5 views in a specific grid layout on a solid DARK background (#121212).
    - Top Row: 2 equal-sized square/rectangular views (View 1, View 2).
    - Middle Row: 2 equal-sized square/rectangular views (View 3, View 4).
    - Bottom Row: 1 large horizontal panoramic view spanning the full width of the two columns above (View 5).
    The 5 views must be perfectly synchronized in style, materials, and lighting.
    Style: Professional architectural photography, consistent lighting and materials across all views. High detailed, photorealistic. ${COMMON_CONSTRAINT}`
  }
];

export const MULTI_ANGLE_SUB_PROMPTS = [
  "View 1: Toàn Cảnh (Wide Shot). Chụp toàn bộ không gian và bối cảnh trong ảnh tham chiếu, thể hiện trọn vẹn bố cục kiến trúc. Giữ nguyên độ phân giải gốc, duy trì độ sắc nét nguyên bản, không làm mờ, không nén, không thay đổi chi tiết.",
  "View 2: Trung Cảnh (Medium Shot). Chụp tập trung vào khu vực chính của ảnh tham chiếu, thể hiện rõ sự kết nối giữa các thành phần kiến trúc. Giữ nguyên độ phân giải gốc, duy trì độ sắc nét nguyên bản, không làm mờ, không nén, không thay đổi chi tiết.",
  "View 3: Cận Cảnh (Close-up Shot). Chụp cận cảnh vào một mảng không gian hoặc vật liệu cụ thể từ ảnh tham chiếu. Giữ nguyên độ phân giải gốc, duy trì độ sắc nét nguyên bản, không làm mờ, không nén, không thay đổi chi tiết.",
  "View 4: Đặc Tả (Macro/Detail Shot). Chụp đặc tả nghệ thuật vào một chi tiết kiến trúc hoặc vật liệu tinh xảo duy nhất từ ảnh tham chiếu. Giữ nguyên độ phân giải gốc, duy trì độ sắc nét nguyên bản, không làm mờ, không nén, không thay đổi chi tiết.",
  "View 5: Góc Ngang Toàn Cảnh (Horizontal Wide View). Chụp góc ngang rộng bao quát, thể hiện chiều sâu và sự sang trọng của toàn bộ không gian. Giữ nguyên độ phân giải gốc, duy trì độ sắc nét nguyên bản, không làm mờ, không nén, không thay đổi chi tiết."
];

export const ARCHITECTURAL_ANGLES = [
  { label: "Toàn cảnh (Wide shot)", value: "Wide shot:" },
  { label: "Trung cảnh (Medium shot)", value: "Medium shot:" },
  { label: "Cận cảnh (Close-up)", value: "Close-up:" },
  { label: "Viễn cảnh (Extreme Long Shot)", value: "Extreme Long Shot:" },
  { label: "Đặc tả (Extreme Close-up)", value: "Extreme Close-up:" },
  { label: "Góc ngang tầm mắt (Eye-level Angle)", value: "Eye-level Angle:" },
  { label: "Góc thấp / Góc hất lên (Low Angle)", value: "Low Angle:" },
  { label: "Góc cao / Góc chúc xuống (High Angle)", value: "High Angle:" },
  { label: "Góc nhìn từ trên không (Bird's-eye view)", value: "Bird's-eye view / Top-down:" },
  { label: "Góc nhìn của kiến (Worm's-eye view)", value: "Worm's-eye view:" },
  { label: "Góc nghiêng (Dutch Angle)", value: "Dutch Angle / Canted Angle:" }
];
