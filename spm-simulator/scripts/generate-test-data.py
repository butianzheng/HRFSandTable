#!/usr/bin/env python3
"""
生成热轧平整机组排程系统测试数据
生成CSV格式的材料数据，可直接导入系统
"""

import csv
import random
from datetime import datetime, timedelta

# 数据配置
STEEL_GRADES = ['SPCC', 'SPCD', 'SPCE', 'SPHC', 'SPHD', 'SPHE', 'DC01', 'DC03', 'DC04', 'DC05', 'DC06']
HARDNESS_LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'HR', 'HV']
SURFACE_LEVELS = ['FB', 'FC', 'FD', 'FA']
ROUGHNESS_REQ = ['Ra0.4', 'Ra0.6', 'Ra0.8', 'Ra1.0', 'Ra1.2']
PRODUCT_TYPES = ['汽车板', '家电板', '建筑板', '普通板', '高强板']
CONTRACT_ATTRS = ['常规', '急单', '试制', '返修']
CONTRACT_NATURES = ['国内', '国外', '内部']
CUSTOMERS = [
    ('一汽大众', 'FAW-VW'),
    ('上汽通用', 'SAIC-GM'),
    ('比亚迪', 'BYD'),
    ('美的集团', 'MIDEA'),
    ('格力电器', 'GREE'),
    ('海尔集团', 'HAIER'),
    ('华为技术', 'HUAWEI'),
    ('长城汽车', 'GWM'),
    ('吉利汽车', 'GEELY'),
    ('宝钢集团', 'BAOSTEEL'),
]
STORAGE_LOCS = ['1A01', '1A02', '1B01', '1B02', '2A01', '2A02', '2B01', '2B02', '3A01', '3A02']
BATCH_CODES = ['BTH2024001', 'BTH2024002', 'BTH2024003', 'BTH2024004', 'BTH2024005']

def generate_coil_id(index):
    """生成钢卷号"""
    date_str = datetime.now().strftime('%Y%m')
    return f"C{date_str}{index:04d}"

def generate_contract_no(customer_code, index):
    """生成合同号"""
    year = datetime.now().year
    return f"{customer_code}-{year}-{index:03d}"

def random_date(start_days_ago, end_days_ago):
    """生成随机日期"""
    now = datetime.now()
    start = now - timedelta(days=start_days_ago)
    end = now - timedelta(days=end_days_ago)
    delta = end - start
    random_days = random.random() * delta.total_seconds() / 86400
    return (start + timedelta(days=random_days)).strftime('%Y-%m-%d %H:%M:%S')

def random_due_date(days_from_now_min, days_from_now_max):
    """生成随机交期"""
    now = datetime.now()
    days = random.randint(days_from_now_min, days_from_now_max)
    return (now + timedelta(days=days)).strftime('%Y-%m-%d')

def generate_material_data(count=100):
    """生成测试材料数据"""
    materials = []

    for i in range(1, count + 1):
        customer_name, customer_code = random.choice(CUSTOMERS)
        steel_grade = random.choice(STEEL_GRADES)

        # 厚度范围：0.3-3.0mm
        thickness = round(random.uniform(0.3, 3.0), 2)

        # 宽度范围：800-1500mm
        width = round(random.uniform(800, 1500), 1)

        # 重量范围：5-30吨
        weight = round(random.uniform(5.0, 30.0), 2)

        # 延伸率：20-45%
        elongation_req = round(random.uniform(20, 45), 1) if random.random() > 0.3 else None

        # 卷取时间：最近60天内的随机时间
        coiling_time = random_date(60, 0)

        # 交期：未来7-90天
        due_date = random_due_date(7, 90) if random.random() > 0.2 else None

        # 库龄：0-60天
        storage_days = random.randint(0, 60)

        # 出口标志和周交期
        export_flag = '是' if random.random() > 0.7 else '否'
        weekly_delivery = '是' if random.random() > 0.8 else '否'

        # 合同属性（20%急单，10%试制，5%返修，其余常规）
        rand = random.random()
        if rand > 0.95:
            contract_attr = '返修'
        elif rand > 0.9:
            contract_attr = '试制'
        elif rand > 0.8:
            contract_attr = '急单'
        else:
            contract_attr = '常规'

        material = {
            '钢卷号': generate_coil_id(i),
            '合同号': generate_contract_no(customer_code, i),
            '客户名称': customer_name,
            '客户代码': customer_code,
            '钢种': steel_grade,
            '厚度': thickness,
            '宽度': width,
            '重量': weight,
            '硬度等级': random.choice(HARDNESS_LEVELS) if random.random() > 0.2 else '',
            '表面等级': random.choice(SURFACE_LEVELS) if random.random() > 0.2 else '',
            '粗糙度要求': random.choice(ROUGHNESS_REQ) if random.random() > 0.3 else '',
            '延伸率要求': elongation_req if elongation_req else '',
            '产品大类': random.choice(PRODUCT_TYPES),
            '合同属性': contract_attr,
            '合同性质': random.choice(CONTRACT_NATURES),
            '出口标志': export_flag,
            '周交期': weekly_delivery,
            '集批代码': random.choice(BATCH_CODES) if random.random() > 0.4 else '',
            '卷取时间': coiling_time,
            '库龄': storage_days,
            '库位': random.choice(STORAGE_LOCS),
            '交期': due_date if due_date else '',
            '备注': f'测试数据{i}' if random.random() > 0.7 else '',
        }

        materials.append(material)

    return materials

def save_to_csv(materials, filename):
    """保存为CSV文件"""
    if not materials:
        return

    fieldnames = list(materials[0].keys())

    with open(filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(materials)

    print(f"✓ 已生成 {len(materials)} 条测试数据，保存至: {filename}")

def main():
    """主函数"""
    print("=" * 60)
    print("热轧平整机组排程系统 - 测试数据生成工具")
    print("=" * 60)

    # 生成不同规模的测试数据
    datasets = [
        (50, 'test-data-50.csv', '小规模测试数据 (50条)'),
        (100, 'test-data-100.csv', '中规模测试数据 (100条)'),
        (500, 'test-data-500.csv', '大规模测试数据 (500条)'),
    ]

    for count, filename, description in datasets:
        print(f"\n生成 {description}...")
        materials = generate_material_data(count)
        save_to_csv(materials, filename)

    print("\n" + "=" * 60)
    print("数据生成完成！")
    print("=" * 60)
    print("\n使用说明：")
    print("1. 在应用中进入「数据管理」页面")
    print("2. 点击「导入材料」按钮")
    print("3. 选择生成的 CSV 文件")
    print("4. 系统会自动识别字段并导入数据")
    print("\n字段映射说明：")
    print("- CSV 文件使用中文列名，系统会自动映射到数据库字段")
    print("- 如果自动映射失败，可以在「字段映射」页面创建映射模板")
    print()

if __name__ == '__main__':
    main()
