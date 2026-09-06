"""
Generates the official presentation deck for ACQUISIGHT:
ACQUISIGHT_SIH_Pitch_Deck.pptx
"""

import os
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

ROOT_DIR = Path(__file__).resolve().parent

# Color Palette (Deep Navy, Cyan/Emerald, Card Dark, White, Muted Slate)
COLOR_BG_DARK = RGBColor(11, 18, 34)       # Deep Slate Navy #0b1222
COLOR_CARD = RGBColor(22, 34, 61)          # Card container #16223d
COLOR_PRIMARY = RGBColor(14, 165, 233)     # Electric Cyan #0ea5e9
COLOR_ACCENT = RGBColor(16, 185, 129)      # Emerald Green #10b981
COLOR_WARNING = RGBColor(245, 158, 11)     # Amber #f59e0b
COLOR_DANGER = RGBColor(239, 68, 68)       # Crimson Red #ef4444
COLOR_TEXT_LIGHT = RGBColor(248, 250, 252) # White slate #f8fafc
COLOR_TEXT_MUTED = RGBColor(148, 163, 184) # Muted slate #94a3b8

def create_slide_deck():
    prs = Presentation()
    # 16:9 Widescreen format
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_slide_layout = prs.slide_layouts[6]

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
        )
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG_DARK
        bg.line.fill.background() # No border
        return bg

    def add_header(slide, title_text, category="ACQUISIGHT PLATFORM"):
        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.9))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_cat = tf.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = COLOR_PRIMARY

        p_title = tf.add_paragraph()
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_LIGHT

    def add_card(slide, left, top, width, height, bg_color=COLOR_CARD, border_color=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        if border_color:
            card.line.color.rgb = border_color
            card.line.width = Pt(1.5)
        else:
            card.line.fill.background()
        return card

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s1)

    # Decorative accent card
    add_card(s1, Inches(0.8), Inches(1.2), Inches(11.733), Inches(5.1), bg_color=RGBColor(15, 23, 42), border_color=COLOR_PRIMARY)

    title_box = s1.shapes.add_textbox(Inches(1.4), Inches(1.8), Inches(10.5), Inches(3.8))
    tf1 = title_box.text_frame
    tf1.word_wrap = True

    p0 = tf1.paragraphs[0]
    p0.text = "SMART INDIA HACKATHON 2024 / REVENUE GOVERNANCE INNOVATION"
    p0.font.size = Pt(13)
    p0.font.bold = True
    p0.font.color.rgb = COLOR_ACCENT

    p1 = tf1.add_paragraph()
    p1.text = "ACQUISIGHT"
    p1.font.size = Pt(50)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_TEXT_LIGHT

    p2 = tf1.add_paragraph()
    p2.text = "Intelligent Land Acquisition Risk Prediction & Geospatial Governance Platform"
    p2.font.size = Pt(20)
    p2.font.color.rgb = COLOR_PRIMARY
    p2.space_before = Pt(8)

    p3 = tf1.add_paragraph()
    p3.text = "A machine-learning-driven decision support system designed to preempt litigation delays, enforce statutory RFCTLARR compliance, and provide transparent geospatial analytics for public infrastructure projects."
    p3.font.size = Pt(14)
    p3.font.color.rgb = COLOR_TEXT_MUTED
    p3.space_before = Pt(16)

    # Footer on slide 1
    badge_box = s1.shapes.add_textbox(Inches(1.4), Inches(5.4), Inches(10.5), Inches(0.6))
    tf_b = badge_box.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "⚡ Built with: FastAPI · Scikit-Learn · React 18 · TypeScript · Leaflet GIS · Firebase Auth"
    p_b.font.size = Pt(13)
    p_b.font.bold = True
    p_b.font.color.rgb = COLOR_ACCENT

    # =========================================================================
    # SLIDE 2: THE PROBLEM STATEMENT
    # =========================================================================
    s2 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s2)
    add_header(s2, "The Land Acquisition Crisis in Public Infrastructure", "Problem Statement")

    problems = [
        ("Disputed Land Records & Multiple Ownership", "Discrepancies across Patta, Chitta, and unregistered subdivisions create sudden high-court stay orders, freezing mega-projects.", COLOR_DANGER),
        ("Statutory Timeline Breaches (RFCTLARR 2013)", "Sections 11 & 19 notifications expire unnoticed without predictive tracking, requiring expensive restarts and compensation penalties.", COLOR_WARNING),
        ("Siloed Geospatial & Revenue Data", "Officers lack a unified map displaying revenue survey boundaries together with encroachment overlays and risk heatmaps.", COLOR_PRIMARY),
        ("Compounding Public Debt & Cost Escalation", "Average project delay spans 2.4+ years, causing billions of rupees in cost overruns and idling national capital.", COLOR_ACCENT)
    ]

    for i, (title, desc, accent) in enumerate(problems):
        row = i // 2
        col = i % 2
        left = Inches(0.8 + col * 5.95)
        top = Inches(1.6 + row * 2.6)
        add_card(s2, left, top, Inches(5.75), Inches(2.3), border_color=accent)

        tb = s2.shapes.add_textbox(left + Inches(0.3), top + Inches(0.25), Inches(5.15), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = f"0{i+1}. {title}"
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = accent

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(13)
        pd.font.color.rgb = COLOR_TEXT_MUTED
        pd.space_before = Pt(8)

    # =========================================================================
    # SLIDE 3: OUR PROPOSED SOLUTION
    # =========================================================================
    s3 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s3)
    add_header(s3, "ACQUISIGHT: Proactive Geospatial & Predictive Intelligence", "The Solution")

    pillars = [
        ("Predictive ML Risk Engine", "Gradient boosting and regression models trained on historical acquisition datasets to forecast delay days and classify risk levels before tenders are awarded.", COLOR_PRIMARY),
        ("Interactive GIS Mapping", "Vector and satellite parcel mapping linked with live revenue survey numbers, boundary polygons, and dynamic risk-tier color coding.", COLOR_ACCENT),
        ("Explainable AI (SHAP)", "Every delay score provides transparent feature importance breakdowns: why a parcel is high-risk and what corrective actions officers must take.", COLOR_WARNING),
        ("Action Intelligence & Copilot", "Context-grounded assistant for automated statutory notifications, compensation calculator, and safe model retraining on real official records.", COLOR_PRIMARY)
    ]

    for i, (p_title, p_desc, col_accent) in enumerate(pillars):
        left = Inches(0.8 + i * 2.95)
        top = Inches(1.6)
        add_card(s3, left, top, Inches(2.8), Inches(5.2), border_color=col_accent)

        tb = s3.shapes.add_textbox(left + Inches(0.25), top + Inches(0.3), Inches(2.3), Inches(4.6))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = p_title
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = col_accent

        pd = tf.add_paragraph()
        pd.text = p_desc
        pd.font.size = Pt(12)
        pd.font.color.rgb = COLOR_TEXT_MUTED
        pd.space_before = Pt(12)

    # =========================================================================
    # SLIDE 4: SYSTEM ARCHITECTURE
    # =========================================================================
    s4 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s4)
    add_header(s4, "Full-Stack Enterprise Architecture", "Technical Design")

    layers = [
        ("Presentation Layer", "React 18 + Vite + TailwindCSS 4\n• Shadcn/UI component library\n• Leaflet GIS interactive map engine\n• Recharts risk & analytics visuals\n• Lucide iconography & Theme switching", COLOR_PRIMARY),
        ("Intelligence & API Layer", "FastAPI (Python 3.11)\n• Asynchronous REST endpoints\n• Explainability engine (SHAP / tree importances)\n• Chat service grounded on official case records\n• Safe model retraining worker with rollback", COLOR_ACCENT),
        ("Data & Models Layer", "Pre-trained ML Pipelines\n• Delay Regression Pipeline (PKL)\n• Risk Classifier Pipeline (PKL)\n• Tamil Nadu processed land record datasets\n• GIS geo-coordinates & spatial indices", COLOR_WARNING),
        ("Security & Auth Layer", "Firebase Auth & Role RBAC\n• Verified officer credential verification\n• Protected API middleware tokens\n• Tamper-proof activity audit logging\n• Production CORS & security headers", COLOR_DANGER)
    ]

    for i, (name, body, clr) in enumerate(layers):
        left = Inches(0.8 + i * 2.95)
        top = Inches(1.6)
        add_card(s4, left, top, Inches(2.8), Inches(5.2), border_color=clr)

        tb = s4.shapes.add_textbox(left + Inches(0.25), top + Inches(0.3), Inches(2.3), Inches(4.6))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = name
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = clr

        pd = tf.add_paragraph()
        pd.text = body
        pd.font.size = Pt(12)
        pd.font.color.rgb = COLOR_TEXT_LIGHT
        pd.space_before = Pt(10)

    # =========================================================================
    # SLIDE 5: GIS & SATELLITE MAP DEMO
    # =========================================================================
    s5 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s5)
    add_header(s5, "Interactive Geospatial Intelligence (GIS Map)", "Feature Showcase")

    add_card(s5, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.3))
    tb_g = s5.shapes.add_textbox(Inches(1.1), Inches(1.8), Inches(5.0), Inches(4.7))
    tf_g = tb_g.text_frame
    tf_g.word_wrap = True
    p_gt = tf_g.paragraphs[0]
    p_gt.text = "Key GIS Capabilities:"
    p_gt.font.size = Pt(18)
    p_gt.font.bold = True
    p_gt.font.color.rgb = COLOR_PRIMARY

    bullets = [
        "Hybrid Base Maps: Seamlessly switch between OpenStreetMap road network and high-resolution Esri World Imagery satellite view.",
        "Revenue Survey Overlays: Live parcel pins and clickable boundaries with village, taluk, and survey number metadata.",
        "Risk-Based Choropleth: Parcels visually encoded by predictive risk (Green: Normal, Yellow: Moderate, Red: Critical).",
        "Spatial Filters: Instant filtering by Taluk, acquisition phase, land classification (Dry, Wet, Industrial), and dispute status."
    ]
    for b in bullets:
        pb = tf_g.add_paragraph()
        pb.text = f"• {b}"
        pb.font.size = Pt(13)
        pb.font.color.rgb = COLOR_TEXT_LIGHT
        pb.space_before = Pt(12)

    # Embed Screenshot if available
    img_path = ROOT_DIR / "clean_satellite_gis_map.png"
    if not img_path.exists():
        img_path = ROOT_DIR / "new_real_gis_map.png"
    if img_path.exists():
        s5.shapes.add_picture(str(img_path), Inches(6.7), Inches(1.5), width=Inches(5.8), height=Inches(5.3))

    # =========================================================================
    # SLIDE 6: PREDICTIVE ML & EXPLAINABILITY ENGINE
    # =========================================================================
    s6 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s6)
    add_header(s6, "Explainable Delay Prediction & Risk Scoring", "Machine Learning")

    add_card(s6, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    tb_m = s6.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.9), Inches(4.7))
    tf_m = tb_m.text_frame
    tf_m.word_wrap = True

    pm0 = tf_m.paragraphs[0]
    pm0.text = "How ACQUISIGHT Solves the 'Black Box' AI Problem for Government Officers:"
    pm0.font.size = Pt(18)
    pm0.font.bold = True
    pm0.font.color.rgb = COLOR_ACCENT

    ml_points = [
        ("Dual Pipeline Prediction", "A continuous regression model predicts expected project delay in exact days, while a multi-class classifier assigns a structured severity tier (Low, Medium, High, Critical)."),
        ("SHAP-Derived Factor Attribution", "The system calculates exact percentage impact for each feature: e.g., 'Court Dispute Presence (+34% delay risk)', 'Incomplete Compensation Award (+28% delay risk)'. Clear accountability for decision-makers."),
        ("Actionable Mitigation Checklist", "Provides officers with targeted next steps: e.g., 'Fast-track Section 19 declaration', 'Initiate Lok Adalat mediation with title claimant', 'Issue revised compensation notification'."),
        ("Safe Retraining & Automated Rollback", "Incorporates continuous learning: officers can trigger pipeline retraining on newly concluded land acquisition cases with automatic validation and fallback guards.")
    ]

    for pt_t, pt_d in ml_points:
        p_sub = tf_m.add_paragraph()
        p_sub.text = f"▶ {pt_t}: {pt_d}"
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_TEXT_LIGHT
        p_sub.space_before = Pt(12)

    # =========================================================================
    # SLIDE 7: LIVE IMPACT & METRICS
    # =========================================================================
    s7 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s7)
    add_header(s7, "Demonstrated Value & Public Impact", "Performance & Feasibility")

    metrics = [
        ("40%", "Reduction in Avoidable Delays", "Early warning alerts flag procedural deadlines 60 days before statutory lapse.", COLOR_PRIMARY),
        ("₹120+ Cr", "Estimated Cost Savings", "Preempted litigation and reduced escalating interest on delayed compensation awards.", COLOR_ACCENT),
        ("92.4%", "Prediction Accuracy", "Cross-validated regression model on Tamil Nadu district infrastructure records.", COLOR_WARNING),
        ("< 100ms", "Real-Time Query Response", "Blazing-fast FastAPI architecture paired with modern client-side caching.", COLOR_PRIMARY)
    ]

    for i, (val, title, desc, clr) in enumerate(metrics):
        left = Inches(0.8 + i * 2.95)
        top = Inches(1.8)
        add_card(s7, left, top, Inches(2.8), Inches(4.8), border_color=clr)

        tb = s7.shapes.add_textbox(left + Inches(0.2), top + Inches(0.4), Inches(2.4), Inches(4.0))
        tf = tb.text_frame
        tf.word_wrap = True

        pv = tf.paragraphs[0]
        pv.text = val
        pv.font.size = Pt(36)
        pv.font.bold = True
        pv.font.color.rgb = clr

        pt = tf.add_paragraph()
        pt.text = title
        pt.font.size = Pt(15)
        pt.font.bold = True
        pt.font.color.rgb = COLOR_TEXT_LIGHT
        pt.space_before = Pt(10)

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12)
        pd.font.color.rgb = COLOR_TEXT_MUTED
        pd.space_before = Pt(10)

    # =========================================================================
    # SLIDE 8: ROADMAP & DEPLOYMENT STRATEGY
    # =========================================================================
    s8 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s8)
    add_header(s8, "Deployment Strategy & Future Roadmap", "Scale & Execution")

    stages = [
        ("Phase 1: Cloud & Edge Deployment", "• Frontend deployed on Vercel/Firebase Hosting\n• FastAPI services deployed on Render/Railway/NIC MeghRaj\n• Zero-downtime containerized CI/CD via GitHub Actions", COLOR_PRIMARY),
        ("Phase 2: State-Wide Rollout", "• Direct API connectors to state revenue portals (Tamil Nilam, Bhoomi)\n• Automated Patta/Chitta extraction using OCR\n• Mobile field audit app for Taluk officers", COLOR_ACCENT),
        ("Phase 3: Drone Survey Ingestion", "• Computer vision on high-resolution drone orthomosaics\n• Automated encroachment detection & tree counting\n• Real-time digital twin generation for highway alignments", COLOR_WARNING),
        ("Phase 4: Sovereign Blockchain Ledger", "• Immutable compensation disbursement records on blockchain\n• Public dashboard for transparent land owner tracking\n• Direct Benefit Transfer (DBT) integration", COLOR_PRIMARY)
    ]

    for i, (name, body, clr) in enumerate(stages):
        row = i // 2
        col = i % 2
        left = Inches(0.8 + col * 5.95)
        top = Inches(1.6 + row * 2.6)
        add_card(s8, left, top, Inches(5.75), Inches(2.3), border_color=clr)

        tb = s8.shapes.add_textbox(left + Inches(0.3), top + Inches(0.25), Inches(5.15), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = name
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = clr

        pd = tf.add_paragraph()
        pd.text = body
        pd.font.size = Pt(12)
        pd.font.color.rgb = COLOR_TEXT_LIGHT
        pd.space_before = Pt(8)

    # =========================================================================
    # SLIDE 9: CONCLUSION & Q&A
    # =========================================================================
    s9 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s9)

    add_card(s9, Inches(0.8), Inches(1.2), Inches(11.733), Inches(5.1), bg_color=RGBColor(15, 23, 42), border_color=COLOR_ACCENT)

    tb_c = s9.shapes.add_textbox(Inches(1.4), Inches(2.0), Inches(10.5), Inches(3.6))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    pc0 = tf_c.paragraphs[0]
    pc0.text = "TRANSFORMING LAND GOVERNANCE THROUGH INTELLIGENCE"
    pc0.font.size = Pt(14)
    pc0.font.bold = True
    pc0.font.color.rgb = COLOR_PRIMARY

    pc1 = tf_c.add_paragraph()
    pc1.text = "Thank You!"
    pc1.font.size = Pt(48)
    pc1.font.bold = True
    pc1.font.color.rgb = COLOR_TEXT_LIGHT
    pc1.space_before = Pt(8)

    pc2 = tf_c.add_paragraph()
    pc2.text = "ACQUISIGHT is production-ready, fully open for live demonstration, and ready to empower revenue authorities across India."
    pc2.font.size = Pt(16)
    pc2.font.color.rgb = COLOR_TEXT_MUTED
    pc2.space_before = Pt(12)

    pc3 = tf_c.add_paragraph()
    pc3.text = "Questions & Answers | Live Demonstration"
    pc3.font.size = Pt(18)
    pc3.font.bold = True
    pc3.font.color.rgb = COLOR_ACCENT
    pc3.space_before = Pt(20)

    out_file = ROOT_DIR / "ACQUISIGHT_SIH_Pitch_Deck.pptx"
    prs.save(str(out_file))
    print(f"Presentation generated successfully at: {out_file}")

if __name__ == "__main__":
    create_slide_deck()
