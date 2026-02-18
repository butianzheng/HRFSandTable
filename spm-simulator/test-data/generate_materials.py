"""
Generate 10,000 realistic hot-rolling material test records as CSV.
Fields match the default import mapping (Chinese column headers).

Constraints:
  - thickness <= 20 mm
  - width     <= 2250 mm
  - weight    <= 40 tons (per single material)

Multi-scenario coverage:
  - Boundary values (min/max thickness, width, weight)
  - All product types, steel grades, hardness/surface combinations
  - Export / domestic, contract attribute/nature permutations
  - Urgent / VIP / priority orders
  - With/without optional fields (due date, batch code, roughness, elongation)
  - Various storage age distributions
  - Weekly delivery scenarios
"""

import csv
import random
import os
from datetime import datetime, timedelta

random.seed(2026)

# ─── Lookup tables ───
STEEL_GRADES = [
    "Q235B", "Q345B", "Q345C", "Q355B", "Q355C",
    "SPHC", "SPHD", "SPHE", "SS400", "SS490",
    "Q195", "Q215", "Q275", "Q390B", "Q420B",
    "DC01", "DC03", "DC04", "DC06", "SAPH440",
    "S235JR", "S275JR", "S355JR", "SM490A", "SM520B",
]

HARDNESS_LEVELS = ["软", "中", "硬"]
HARDNESS_WEIGHTS = [0.3, 0.5, 0.2]

SURFACE_LEVELS = ["FA", "FB", "FC", "FD"]
SURFACE_WEIGHTS = [0.15, 0.35, 0.35, 0.15]

PRODUCT_TYPES = [
    "热轧板卷", "热轧带钢", "热轧酸洗板",
    "花纹板", "热轧窄带钢", "结构钢板",
    "造船板", "管线钢板", "汽车结构钢",
]

CONTRACT_ATTRS = ["出口合同", "期货合同", "现货合同", "过渡材合同", "其他"]
CONTRACT_ATTR_WEIGHTS = [0.08, 0.12, 0.50, 0.10, 0.20]

CONTRACT_NATURES = ["正式合同", "框架协议", "临时订单"]

CUSTOMER_NAMES = [
    "宝钢股份", "鞍钢股份", "首钢集团", "河钢集团", "马钢股份",
    "太钢不锈", "柳钢集团", "日照钢铁", "沙钢集团", "中天钢铁",
    "华菱钢铁", "新余钢铁", "南京钢铁", "酒泉钢铁", "包头钢铁",
    "山东钢铁", "本钢集团", "三宝钢铁", "永锋钢铁", "方大钢铁",
    "福建三钢", "八一钢铁", "西宁钢铁", "安阳钢铁", "湘潭钢铁",
    "新兴铸管", "韶关钢铁", "广钢集团", "海鑫钢铁", "达州钢铁",
]

STORAGE_LOCS = [
    "A区-01", "A区-02", "A区-03", "A区-04", "A区-05",
    "B区-01", "B区-02", "B区-03", "B区-04", "B区-05",
    "C区-01", "C区-02", "C区-03", "C区-04", "C区-05",
    "D区-01", "D区-02", "D区-03",
    "E区-01", "E区-02",
]

BATCH_PREFIXES = ["BTH", "GRP", "LOT", "SET"]

ROUGHNESS_OPTIONS = ["Ra0.8", "Ra1.6", "Ra3.2", "Ra6.3"]

REMARKS_OPTIONS = [
    "优先处理", "紧急订单", "客户催交", "表面质量要求高",
    "需配合交货", "库龄较长", "VIP客户",
]

# ─── Generation parameters ───
TOTAL = 10_000
BASE_DATE = datetime(2026, 2, 17, 0, 0, 0)
COILING_SPAN_DAYS = 25  # coiling times spread over 25 days before base
DUE_DATE_SPAN_DAYS = 35  # due dates spread 35 days after base

# Maximum constraints
MAX_THICKNESS = 20.0   # mm
MAX_WIDTH = 2250       # mm
MAX_WEIGHT = 40.0      # tons

# Thickness ranges by product type (mm) — all capped at 20mm
THICKNESS_RANGES = {
    "热轧板卷":   (1.2, 16.0),
    "热轧带钢":   (1.5, 8.0),
    "热轧酸洗板": (1.2, 6.0),
    "花纹板":     (2.5, 10.0),
    "热轧窄带钢": (1.5, 6.0),
    "结构钢板":   (4.0, 20.0),
    "造船板":     (6.0, 20.0),
    "管线钢板":   (6.0, 20.0),
    "汽车结构钢": (1.2, 4.0),
}

# Width ranges by product type (mm) — all capped at 2250mm
WIDTH_RANGES = {
    "热轧板卷":   (900, 2050),
    "热轧带钢":   (600, 1600),
    "热轧酸洗板": (900, 1600),
    "花纹板":     (1000, 1800),
    "热轧窄带钢": (200, 600),
    "结构钢板":   (1500, 2250),
    "造船板":     (1500, 2250),
    "管线钢板":   (1200, 2250),
    "汽车结构钢": (800, 1500),
}


def rand_coiling_time() -> str:
    offset = random.randint(0, COILING_SPAN_DAYS * 24 * 60)
    dt = BASE_DATE - timedelta(minutes=offset)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def rand_due_date(force_empty=False, force_present=False) -> str:
    if force_empty:
        return ""
    if force_present or random.random() >= 0.15:
        offset_days = random.randint(-5, DUE_DATE_SPAN_DAYS)
        dt = BASE_DATE + timedelta(days=offset_days)
        return dt.strftime("%Y-%m-%d")
    return ""


def calc_weight(thickness: float, width: float, factor: float = None) -> float:
    """Calculate weight with dimensional correlation, capped at MAX_WEIGHT."""
    if factor is None:
        factor = random.uniform(1.5, 4.5)
    weight = thickness * width / 1000.0 * factor
    return min(round(weight, 2), MAX_WEIGHT)


def generate_row(idx: int, scenario: dict = None) -> dict:
    """Generate a single row. Optional scenario dict overrides specific fields."""
    s = scenario or {}

    coil_id = f"HC{idx:06d}"
    contract_prefix = s.get("contract_prefix", random.choice(["HT", "CT", "PT", "EX", "FW"]))
    contract_no = f"{contract_prefix}{random.randint(202601, 202612):06d}-{random.randint(1, 999):03d}"
    customer = s.get("customer", random.choice(CUSTOMER_NAMES))
    customer_code = f"C{random.randint(1000, 9999)}"
    steel_grade = s.get("steel_grade", random.choice(STEEL_GRADES))
    product_type = s.get("product_type", random.choice(PRODUCT_TYPES))

    # Thickness
    t_lo, t_hi = THICKNESS_RANGES[product_type]
    if "thickness" in s:
        thickness = s["thickness"]
    else:
        thickness = round(random.uniform(t_lo, t_hi), 2)
    thickness = min(thickness, MAX_THICKNESS)

    # Width
    w_lo, w_hi = WIDTH_RANGES[product_type]
    if "width" in s:
        width = s["width"]
    else:
        width = round(random.uniform(w_lo, w_hi), 0)
    width = min(int(width), MAX_WIDTH)

    # Weight
    if "weight" in s:
        weight = min(s["weight"], MAX_WEIGHT)
    else:
        weight = calc_weight(thickness, width)

    # Hardness
    hardness = s.get("hardness", random.choices(HARDNESS_LEVELS, HARDNESS_WEIGHTS)[0])
    # Surface
    surface = s.get("surface", random.choices(SURFACE_LEVELS, SURFACE_WEIGHTS)[0])

    # Optional fields
    if "roughness" in s:
        roughness = s["roughness"]
    else:
        roughness = random.choice(["", "Ra0.8", "Ra1.6", "Ra3.2", "Ra6.3"])

    if "elongation" in s:
        elongation = s["elongation"]
    elif random.random() < 0.4:
        elongation = round(random.uniform(15, 45), 1)
    else:
        elongation = ""

    contract_attr = s.get("contract_attr", random.choices(CONTRACT_ATTRS, CONTRACT_ATTR_WEIGHTS)[0])
    contract_nature = s.get("contract_nature", random.choice(CONTRACT_NATURES))

    if "export_flag" in s:
        export_flag = s["export_flag"]
    else:
        export_flag = "是" if contract_attr == "出口合同" else ("是" if random.random() < 0.03 else "否")

    weekly_delivery = s.get("weekly_delivery", "是" if random.random() < 0.2 else "否")

    if "batch_code" in s:
        batch_code = s["batch_code"]
    elif random.random() < 0.6:
        batch_code = f"{random.choice(BATCH_PREFIXES)}-{random.randint(1, 500):04d}"
    else:
        batch_code = ""

    coiling_time = s.get("coiling_time", rand_coiling_time())
    storage_days = s.get("storage_days", random.randint(0, 20))
    storage_loc = s.get("storage_loc", random.choice(STORAGE_LOCS))

    force_due_empty = s.get("due_date_empty", False)
    force_due_present = s.get("due_date_present", False)
    due_date = s.get("due_date", rand_due_date(force_empty=force_due_empty, force_present=force_due_present))

    remarks = s.get("remarks", random.choice(
        ["", "", "", "", "优先处理", "紧急订单", "客户催交",
         "表面质量要求高", "需配合交货", "库龄较长", "VIP客户"]
    ))

    return {
        "钢卷号": coil_id,
        "合同号": contract_no,
        "客户名称": customer,
        "客户代码": customer_code,
        "钢种": steel_grade,
        "厚度": thickness,
        "宽度": int(width),
        "重量": weight,
        "硬度等级": hardness,
        "表面等级": surface,
        "粗糙度要求": roughness,
        "延伸率要求": elongation,
        "产品大类": product_type,
        "合同属性": contract_attr,
        "合同性质": contract_nature,
        "出口标志": export_flag,
        "周交期": weekly_delivery,
        "集批代码": batch_code,
        "卷取时间": coiling_time,
        "库龄": storage_days,
        "库位": storage_loc,
        "交期": due_date,
        "备注": remarks,
    }


def build_scenario_rows() -> list:
    """
    Build ~2000 dedicated scenario rows for multi-scenario coverage.
    These ensure edge cases and critical combinations are represented.
    """
    scenarios = []

    # ──────────────────────────────────────────────
    # 1. Boundary thickness scenarios (~200 rows)
    # ──────────────────────────────────────────────
    # Min thickness for each product type
    for pt in PRODUCT_TYPES:
        t_lo, _ = THICKNESS_RANGES[pt]
        scenarios.append({"product_type": pt, "thickness": t_lo, "remarks": ""})
    # Max thickness for each product type (capped at 20mm)
    for pt in PRODUCT_TYPES:
        _, t_hi = THICKNESS_RANGES[pt]
        scenarios.append({"product_type": pt, "thickness": min(t_hi, MAX_THICKNESS), "remarks": ""})
    # Exact 20mm boundary
    for pt in ["结构钢板", "造船板", "管线钢板"]:
        scenarios.append({"product_type": pt, "thickness": 20.0})
    # Very thin materials (1.2mm)
    for _ in range(20):
        scenarios.append({"product_type": "汽车结构钢", "thickness": 1.2, "steel_grade": random.choice(["DC01", "DC03", "DC04", "DC06"])})
    # Near-boundary thickness (19.5-20.0mm)
    for _ in range(30):
        scenarios.append({
            "product_type": random.choice(["结构钢板", "造船板", "管线钢板"]),
            "thickness": round(random.uniform(19.0, 20.0), 2),
        })
    # Common standard thicknesses
    for t in [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0]:
        for pt in random.sample(PRODUCT_TYPES, min(3, len(PRODUCT_TYPES))):
            t_lo, t_hi = THICKNESS_RANGES[pt]
            if t_lo <= t <= min(t_hi, MAX_THICKNESS):
                scenarios.append({"product_type": pt, "thickness": t})
    # Total boundary thickness: ~130 rows

    # ──────────────────────────────────────────────
    # 2. Boundary width scenarios (~150 rows)
    # ──────────────────────────────────────────────
    # Min width for each product type
    for pt in PRODUCT_TYPES:
        w_lo, _ = WIDTH_RANGES[pt]
        scenarios.append({"product_type": pt, "width": w_lo})
    # Max width for each product type (capped at 2250)
    for pt in PRODUCT_TYPES:
        _, w_hi = WIDTH_RANGES[pt]
        scenarios.append({"product_type": pt, "width": min(w_hi, MAX_WIDTH)})
    # Exact 2250mm boundary
    for pt in ["结构钢板", "造船板", "管线钢板"]:
        scenarios.append({"product_type": pt, "width": 2250})
    # Narrow width (200-300mm)
    for _ in range(20):
        scenarios.append({"product_type": "热轧窄带钢", "width": random.randint(200, 300)})
    # Near max width (2200-2250mm)
    for _ in range(30):
        scenarios.append({
            "product_type": random.choice(["结构钢板", "造船板", "管线钢板"]),
            "width": random.randint(2200, 2250),
        })
    # Common standard widths
    for w in [600, 800, 1000, 1200, 1500, 1800, 2000, 2250]:
        for pt in random.sample(PRODUCT_TYPES, 2):
            w_lo, w_hi = WIDTH_RANGES[pt]
            if w_lo <= w <= min(w_hi, MAX_WIDTH):
                scenarios.append({"product_type": pt, "width": w})

    # ──────────────────────────────────────────────
    # 3. Boundary weight scenarios (~200 rows)
    # ──────────────────────────────────────────────
    # Very light materials (<1 ton)
    for _ in range(30):
        scenarios.append({
            "product_type": "热轧窄带钢",
            "thickness": round(random.uniform(1.5, 3.0), 2),
            "width": random.randint(200, 350),
            "weight": round(random.uniform(0.3, 0.99), 2),
        })
    # Light materials (1-5 tons)
    for _ in range(30):
        scenarios.append({
            "product_type": random.choice(["热轧窄带钢", "汽车结构钢"]),
            "thickness": round(random.uniform(1.2, 3.0), 2),
            "width": random.randint(300, 600),
            "weight": round(random.uniform(1.0, 5.0), 2),
        })
    # Medium weight (15-25 tons)
    for _ in range(40):
        scenarios.append({
            "product_type": random.choice(PRODUCT_TYPES),
            "weight": round(random.uniform(15.0, 25.0), 2),
        })
    # Heavy materials near limit (35-40 tons)
    for _ in range(50):
        scenarios.append({
            "product_type": random.choice(["结构钢板", "造船板", "管线钢板", "热轧板卷"]),
            "thickness": round(random.uniform(12.0, 20.0), 2),
            "width": random.randint(1800, 2250),
            "weight": round(random.uniform(35.0, 40.0), 2),
        })
    # Exact 40 tons
    for _ in range(20):
        scenarios.append({
            "product_type": random.choice(["结构钢板", "造船板", "管线钢板"]),
            "weight": 40.0,
        })
    # Near zero weight
    for _ in range(10):
        scenarios.append({
            "product_type": "热轧窄带钢",
            "thickness": 1.5,
            "width": 200,
            "weight": round(random.uniform(0.2, 0.5), 2),
        })

    # ──────────────────────────────────────────────
    # 4. Steel grade full coverage (~75 rows)
    # ──────────────────────────────────────────────
    for grade in STEEL_GRADES:
        for _ in range(3):
            scenarios.append({"steel_grade": grade})

    # ──────────────────────────────────────────────
    # 5. Hardness x Surface combinations (~48 rows)
    # ──────────────────────────────────────────────
    for h in HARDNESS_LEVELS:
        for sf in SURFACE_LEVELS:
            for _ in range(4):
                scenarios.append({"hardness": h, "surface": sf})

    # ──────────────────────────────────────────────
    # 6. Contract attribute x nature combinations (~75 rows)
    # ──────────────────────────────────────────────
    for ca in CONTRACT_ATTRS:
        for cn in CONTRACT_NATURES:
            for _ in range(5):
                scenarios.append({"contract_attr": ca, "contract_nature": cn})

    # ──────────────────────────────────────────────
    # 7. Export scenarios (~100 rows)
    # ──────────────────────────────────────────────
    # Explicit export orders
    for _ in range(50):
        scenarios.append({
            "contract_attr": "出口合同",
            "export_flag": "是",
            "contract_prefix": "EX",
        })
    # Domestic orders
    for _ in range(50):
        scenarios.append({
            "contract_attr": "现货合同",
            "export_flag": "否",
        })

    # ──────────────────────────────────────────────
    # 8. Urgent / VIP / priority scenarios (~150 rows)
    # ──────────────────────────────────────────────
    for remark in REMARKS_OPTIONS:
        for _ in range(15):
            scenarios.append({"remarks": remark})
    # Urgent + weekly delivery + near due date
    for _ in range(30):
        near_due = (BASE_DATE + timedelta(days=random.randint(1, 3))).strftime("%Y-%m-%d")
        scenarios.append({
            "remarks": "紧急订单",
            "weekly_delivery": "是",
            "due_date": near_due,
        })
    # VIP + export
    for _ in range(15):
        scenarios.append({
            "remarks": "VIP客户",
            "contract_attr": "出口合同",
            "export_flag": "是",
        })

    # ──────────────────────────────────────────────
    # 9. Optional fields presence/absence (~150 rows)
    # ──────────────────────────────────────────────
    # All optional fields present
    for _ in range(30):
        scenarios.append({
            "roughness": random.choice(ROUGHNESS_OPTIONS),
            "elongation": round(random.uniform(15, 45), 1),
            "batch_code": f"{random.choice(BATCH_PREFIXES)}-{random.randint(1, 500):04d}",
            "due_date_present": True,
            "remarks": random.choice(REMARKS_OPTIONS),
        })
    # All optional fields empty
    for _ in range(30):
        scenarios.append({
            "roughness": "",
            "elongation": "",
            "batch_code": "",
            "due_date_empty": True,
            "remarks": "",
        })
    # Only roughness
    for roughness in ROUGHNESS_OPTIONS:
        for _ in range(5):
            scenarios.append({"roughness": roughness, "elongation": "", "batch_code": ""})
    # Only elongation boundary values
    for elong in [15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0]:
        for _ in range(3):
            scenarios.append({"elongation": elong, "roughness": ""})
    # Only batch codes with each prefix
    for prefix in BATCH_PREFIXES:
        for _ in range(5):
            scenarios.append({"batch_code": f"{prefix}-{random.randint(1, 500):04d}"})

    # ──────────────────────────────────────────────
    # 10. Storage age distribution scenarios (~100 rows)
    # ──────────────────────────────────────────────
    # Fresh materials (0 days)
    for _ in range(20):
        scenarios.append({"storage_days": 0, "remarks": ""})
    # Old materials (18-20 days) — may trigger "库龄较长"
    for _ in range(30):
        scenarios.append({"storage_days": random.randint(18, 20), "remarks": "库龄较长"})
    # Medium storage age
    for _ in range(20):
        scenarios.append({"storage_days": random.randint(7, 14)})
    # Exact boundary
    scenarios.append({"storage_days": 0})
    scenarios.append({"storage_days": 20})
    # Each storage location
    for loc in STORAGE_LOCS:
        scenarios.append({"storage_loc": loc})

    # ──────────────────────────────────────────────
    # 11. Weekly delivery scenarios (~60 rows)
    # ──────────────────────────────────────────────
    for _ in range(30):
        scenarios.append({"weekly_delivery": "是", "due_date_present": True})
    for _ in range(30):
        scenarios.append({"weekly_delivery": "否"})

    # ──────────────────────────────────────────────
    # 12. Customer coverage scenarios (~60 rows)
    # ──────────────────────────────────────────────
    for cust in CUSTOMER_NAMES:
        scenarios.append({"customer": cust})
        scenarios.append({"customer": cust, "contract_attr": random.choice(CONTRACT_ATTRS)})

    # ──────────────────────────────────────────────
    # 13. Combined edge cases (~100 rows)
    # ──────────────────────────────────────────────
    # Thinnest + widest + lightest
    for _ in range(10):
        scenarios.append({
            "product_type": "汽车结构钢",
            "thickness": 1.2,
            "width": 1500,
            "weight": round(random.uniform(1.0, 5.0), 2),
        })
    # Thickest + widest + heaviest (at limits)
    for _ in range(10):
        scenarios.append({
            "product_type": "结构钢板",
            "thickness": 20.0,
            "width": 2250,
            "weight": 40.0,
        })
    # Thinnest + narrowest
    for _ in range(10):
        scenarios.append({
            "product_type": "热轧窄带钢",
            "thickness": 1.5,
            "width": 200,
        })
    # Thick + narrow (unusual combination)
    for _ in range(10):
        scenarios.append({
            "product_type": "结构钢板",
            "thickness": round(random.uniform(15.0, 20.0), 2),
            "width": 1500,
        })
    # Thin + wide (unusual combination)
    for _ in range(10):
        scenarios.append({
            "product_type": "热轧板卷",
            "thickness": round(random.uniform(1.2, 2.0), 2),
            "width": random.randint(1800, 2050),
        })
    # All max constraints simultaneously
    for _ in range(5):
        scenarios.append({
            "product_type": "造船板",
            "thickness": 20.0,
            "width": 2250,
            "weight": 40.0,
            "hardness": "硬",
            "surface": "FA",
            "remarks": "紧急订单",
            "weekly_delivery": "是",
            "export_flag": "是",
            "contract_attr": "出口合同",
        })
    # All min constraints simultaneously
    for _ in range(5):
        scenarios.append({
            "product_type": "热轧窄带钢",
            "thickness": 1.5,
            "width": 200,
            "weight": 0.3,
            "hardness": "软",
            "surface": "FD",
            "storage_days": 0,
            "remarks": "",
            "batch_code": "",
            "roughness": "",
            "elongation": "",
            "due_date_empty": True,
        })
    # Overdue materials (due date in the past)
    for _ in range(20):
        past_due = (BASE_DATE - timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d")
        scenarios.append({
            "due_date": past_due,
            "remarks": random.choice(["客户催交", "紧急订单"]),
            "storage_days": random.randint(10, 20),
        })
    # Same-day due
    for _ in range(10):
        scenarios.append({
            "due_date": BASE_DATE.strftime("%Y-%m-%d"),
            "remarks": "紧急订单",
        })

    # ──────────────────────────────────────────────
    # 14. Batch grouping scenarios (~80 rows)
    # ──────────────────────────────────────────────
    # Same batch code group (simulate materials that should be scheduled together)
    for prefix in BATCH_PREFIXES:
        batch_id = f"{prefix}-{random.randint(1, 100):04d}"
        grade = random.choice(STEEL_GRADES)
        pt = random.choice(PRODUCT_TYPES)
        customer = random.choice(CUSTOMER_NAMES)
        for _ in range(10):
            scenarios.append({
                "batch_code": batch_id,
                "steel_grade": grade,
                "product_type": pt,
                "customer": customer,
            })
    # Large batch (same batch code, many items)
    large_batch_id = "BTH-9999"
    for _ in range(20):
        scenarios.append({
            "batch_code": large_batch_id,
            "steel_grade": "Q235B",
            "product_type": "热轧板卷",
            "customer": "宝钢股份",
        })
    # No batch code (standalone materials)
    for _ in range(20):
        scenarios.append({"batch_code": ""})

    # ──────────────────────────────────────────────
    # 15. Date edge cases (~50 rows)
    # ──────────────────────────────────────────────
    # Coiling just now
    for _ in range(10):
        scenarios.append({
            "coiling_time": BASE_DATE.strftime("%Y-%m-%d %H:%M:%S"),
            "storage_days": 0,
        })
    # Coiling at boundary (25 days ago)
    old_date = BASE_DATE - timedelta(days=25)
    for _ in range(10):
        scenarios.append({
            "coiling_time": old_date.strftime("%Y-%m-%d %H:%M:%S"),
            "storage_days": 20,
        })
    # Due date far in future
    far_due = (BASE_DATE + timedelta(days=35)).strftime("%Y-%m-%d")
    for _ in range(10):
        scenarios.append({"due_date": far_due})
    # Due date very soon (1 day)
    soon_due = (BASE_DATE + timedelta(days=1)).strftime("%Y-%m-%d")
    for _ in range(10):
        scenarios.append({"due_date": soon_due, "remarks": "紧急订单"})

    return scenarios


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "materials_10000.csv")

    fields = [
        "钢卷号", "合同号", "客户名称", "客户代码", "钢种",
        "厚度", "宽度", "重量", "硬度等级", "表面等级",
        "粗糙度要求", "延伸率要求", "产品大类", "合同属性", "合同性质",
        "出口标志", "周交期", "集批代码", "卷取时间", "库龄",
        "库位", "交期", "备注",
    ]

    # Build scenario rows first
    scenario_list = build_scenario_rows()
    random.shuffle(scenario_list)

    rows = []
    idx = 1

    # Generate scenario-driven rows
    for s in scenario_list:
        if idx > TOTAL:
            break
        rows.append(generate_row(idx, scenario=s))
        idx += 1

    # Fill remaining rows with random data
    while idx <= TOTAL:
        rows.append(generate_row(idx))
        idx += 1

    # Shuffle all rows to mix scenarios with random data
    random.shuffle(rows)

    # Re-assign sequential coil IDs after shuffle
    for i, row in enumerate(rows):
        row["钢卷号"] = f"HC{i + 1:06d}"

    # Final validation pass — enforce constraints
    violations = 0
    for row in rows:
        if row["厚度"] > MAX_THICKNESS:
            row["厚度"] = MAX_THICKNESS
            violations += 1
        if row["宽度"] > MAX_WIDTH:
            row["宽度"] = MAX_WIDTH
            violations += 1
        if row["重量"] > MAX_WEIGHT:
            row["重量"] = MAX_WEIGHT
            violations += 1

    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    # Print statistics
    thicknesses = [r["厚度"] for r in rows]
    widths = [r["宽度"] for r in rows]
    weights = [r["重量"] for r in rows]

    print(f"Generated {len(rows)} rows -> {out_path}")
    print(f"Constraint violations fixed: {violations}")
    print(f"Thickness: min={min(thicknesses)}, max={max(thicknesses)}, avg={sum(thicknesses)/len(thicknesses):.2f}")
    print(f"Width:     min={min(widths)}, max={max(widths)}, avg={sum(widths)/len(widths):.2f}")
    print(f"Weight:    min={min(weights)}, max={max(weights)}, avg={sum(weights)/len(weights):.2f}")

    # Scenario coverage report
    product_counts = {}
    grade_counts = {}
    attr_counts = {}
    hardness_counts = {}
    surface_counts = {}
    export_count = sum(1 for r in rows if r["出口标志"] == "是")
    weekly_count = sum(1 for r in rows if r["周交期"] == "是")
    batch_count = sum(1 for r in rows if r["集批代码"])
    due_count = sum(1 for r in rows if r["交期"])
    remark_count = sum(1 for r in rows if r["备注"])

    for r in rows:
        product_counts[r["产品大类"]] = product_counts.get(r["产品大类"], 0) + 1
        grade_counts[r["钢种"]] = grade_counts.get(r["钢种"], 0) + 1
        attr_counts[r["合同属性"]] = attr_counts.get(r["合同属性"], 0) + 1
        hardness_counts[r["硬度等级"]] = hardness_counts.get(r["硬度等级"], 0) + 1
        surface_counts[r["表面等级"]] = surface_counts.get(r["表面等级"], 0) + 1

    print(f"\n── Coverage Report ──")
    print(f"Product types ({len(product_counts)}): {dict(sorted(product_counts.items(), key=lambda x: -x[1]))}")
    print(f"Steel grades ({len(grade_counts)}): all {len(STEEL_GRADES)} grades covered = {len(grade_counts) == len(STEEL_GRADES)}")
    print(f"Contract attrs ({len(attr_counts)}): {dict(sorted(attr_counts.items(), key=lambda x: -x[1]))}")
    print(f"Hardness: {hardness_counts}")
    print(f"Surface: {surface_counts}")
    print(f"Export: {export_count} ({export_count/len(rows)*100:.1f}%)")
    print(f"Weekly delivery: {weekly_count} ({weekly_count/len(rows)*100:.1f}%)")
    print(f"With batch code: {batch_count} ({batch_count/len(rows)*100:.1f}%)")
    print(f"With due date: {due_count} ({due_count/len(rows)*100:.1f}%)")
    print(f"With remarks: {remark_count} ({remark_count/len(rows)*100:.1f}%)")


if __name__ == "__main__":
    main()
