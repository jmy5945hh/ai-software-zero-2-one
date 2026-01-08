"""测试拜访管理和礼品管理 API"""
import requests
import json
from datetime import date, datetime

BASE_URL = "http://localhost:8000"


def test_visit_and_gift_apis():
    """测试拜访和礼品管理 API"""

    print("=" * 80)
    print("测试拜访管理和礼品管理 API")
    print("=" * 80)

    # 1. 登录获取 token
    print("\n1. 登录系统...")
    login_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "cm001", "password": "password123"}
    )
    print(f"   状态码: {login_response.status_code}")
    if login_response.status_code == 200:
        token = login_response.json()["data"]["access_token"]
        user_id = login_response.json()["data"]["user"]["user_id"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"   ✅ 登录成功, User ID: {user_id}")
    else:
        print(f"   ❌ 登录失败: {login_response.text}")
        return

    # 2. 创建拜访记录
    print("\n2. 创建拜访记录...")
    visit_data = {
        "customer_id": "CUST001",
        "company_name": "测试科技有限公司",
        "planned_date": "2026-01-15",
        "actual_date": "2026-01-15",
        "visit_method": "ON_SITE",
        "interested_products": ["理财产品A", "理财产品B"],
        "participants": [user_id],
        "status": "NEW",
        "notes": "测试拜访记录"
    }
    visit_response = requests.post(
        f"{BASE_URL}/api/v1/auth/visits",
        json=visit_data,
        headers=headers
    )
    print(f"   状态码: {visit_response.status_code}")
    if visit_response.status_code == 200:
        visit = visit_response.json()["data"]
        visit_id = visit["visit_id"]
        print(f"   ✅ 创建拜访记录成功, ID: {visit_id}")
    else:
        print(f"   ❌ 创建拜访记录失败: {visit_response.text}")
        return

    # 3. 查询拜访记录列表
    print("\n3. 查询拜访记录列表...")
    visits_list_response = requests.get(
        f"{BASE_URL}/api/v1/auth/visits",
        headers=headers
    )
    print(f"   状态码: {visits_list_response.status_code}")
    if visits_list_response.status_code == 200:
        visits_data = visits_list_response.json()["data"]
        print(f"   ✅ 查询拜访记录列表成功, 总数: {visits_data['total']}")
    else:
        print(f"   ❌ 查询拜访记录列表失败: {visits_list_response.text}")

    # 4. 获取拜访记录详情
    print("\n4. 获取拜访记录详情...")
    visit_detail_response = requests.get(
        f"{BASE_URL}/api/v1/auth/visits/{visit_id}",
        headers=headers
    )
    print(f"   状态码: {visit_detail_response.status_code}")
    if visit_detail_response.status_code == 200:
        print(f"   ✅ 获取拜访记录详情成功")
    else:
        print(f"   ❌ 获取拜访记录详情失败: {visit_detail_response.text}")

    # 5. 更新拜访记录
    print("\n5. 更新拜访记录...")
    update_data = {
        "status": "IN_PROGRESS",
        "notes": "拜访进行中"
    }
    update_response = requests.put(
        f"{BASE_URL}/api/v1/auth/visits/{visit_id}",
        json=update_data,
        headers=headers
    )
    print(f"   状态码: {update_response.status_code}")
    if update_response.status_code == 200:
        print(f"   ✅ 更新拜访记录成功")
    else:
        print(f"   ❌ 更新拜访记录失败: {update_response.text}")

    # 6. 查询可用礼品列表
    print("\n6. 查询可用礼品列表...")
    gifts_response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts",
        headers=headers
    )
    print(f"   状态码: {gifts_response.status_code}")
    if gifts_response.status_code == 200:
        gifts_data = gifts_response.json()["data"]
        print(f"   ✅ 查询可用礼品列表成功, 总数: {gifts_data['total']}")
        if gifts_data['items']:
            gift_id = gifts_data['items'][0]['gift_id']
            print(f"       示例礼品ID: {gift_id}")
    else:
        print(f"   ❌ 查询可用礼品列表失败: {gifts_response.text}")
        return

    # 7. 创建礼品申请
    print("\n7. 创建礼品申请...")
    requisition_data = {
        "recipient": user_id,
        "gift_items": [
            {"gift_id": gift_id, "quantity": 2}
        ],
        "planned_date": "2026-01-20",
        "purpose_type": "CUSTOMER_VISIT",
        "related_visit_id": visit_id
    }
    requisition_response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        json=requisition_data,
        headers=headers
    )
    print(f"   状态码: {requisition_response.status_code}")
    if requisition_response.status_code == 200:
        requisition = requisition_response.json()["data"]
        requisition_id = requisition["requisition_id"]
        print(f"   ✅ 创建礼品申请成功, ID: {requisition_id}")
        print(f"       总金额: {requisition['total_amount']}")
    else:
        print(f"   ❌ 创建礼品申请失败: {requisition_response.text}")
        return

    # 8. 查询礼品申请列表
    print("\n8. 查询礼品申请列表...")
    requisitions_list_response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        headers=headers
    )
    print(f"   状态码: {requisitions_list_response.status_code}")
    if requisitions_list_response.status_code == 200:
        requisitions_data = requisitions_list_response.json()["data"]
        print(f"   ✅ 查询礼品申请列表成功, 总数: {requisitions_data['total']}")
    else:
        print(f"   ❌ 查询礼品申请列表失败: {requisitions_list_response.text}")

    # 9. 审批人员登录
    print("\n9. 审批人员登录...")
    approver_login_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "approver001", "password": "password123"}
    )
    print(f"   状态码: {approver_login_response.status_code}")
    if approver_login_response.status_code == 200:
        approver_token = approver_login_response.json()["data"]["access_token"]
        approver_headers = {"Authorization": f"Bearer {approver_token}"}
        print(f"   ✅ 审批人员登录成功")
    else:
        print(f"   ❌ 审批人员登录失败: {approver_login_response.text}")
        return

    # 10. 审批通过礼品申请
    print("\n10. 审批通过礼品申请...")
    approve_response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id}/approve",
        json={"comment": "审批通过"},
        headers=approver_headers
    )
    print(f"    状态码: {approve_response.status_code}")
    if approve_response.status_code == 200:
        print(f"    ✅ 审批通过成功")
        approved_requisition = approve_response.json()["data"]
        print(f"        审批状态: {approved_requisition['approval_status']}")
    else:
        print(f"    ❌ 审批通过失败: {approve_response.text}")

    # 11. 运营人员登录并查询礼品台账
    print("\n11. 运营人员登录并查询礼品台账...")
    ops_login_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "operations001", "password": "password123"}
    )
    print(f"    运营人员登录状态码: {ops_login_response.status_code}")
    if ops_login_response.status_code == 200:
        ops_token = ops_login_response.json()["data"]["access_token"]
        ops_headers = {"Authorization": f"Bearer {ops_token}"}

        ledger_response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/ledger",
            headers=ops_headers
        )
        print(f"    查询台账状态码: {ledger_response.status_code}")
        if ledger_response.status_code == 200:
            ledger_data = ledger_response.json()["data"]
            print(f"    ✅ 查询礼品台账成功, 总数: {ledger_data['total']}")
        else:
            print(f"    ❌ 查询礼品台账失败: {ledger_response.text}")
    else:
        print(f"    ❌ 运营人员登录失败")

    # 12. 测试驳回礼品申请
    print("\n12. 创建并驳回新的礼品申请...")
    requisition_data_2 = {
        "recipient": user_id,
        "gift_items": [{"gift_id": gift_id, "quantity": 1}],
        "planned_date": "2026-01-25",
        "purpose_type": "OTHER"
    }
    requisition_response_2 = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        json=requisition_data_2,
        headers=headers
    )
    if requisition_response_2.status_code == 200:
        requisition_id_2 = requisition_response_2.json()["data"]["requisition_id"]
        print(f"    创建第二个申请成功, ID: {requisition_id_2}")

        # 驳回申请
        reject_response = requests.post(
            f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id_2}/reject",
            json={"rejection_reason": "预算不足"},
            headers=approver_headers
        )
        print(f"    驳回状态码: {reject_response.status_code}")
        if reject_response.status_code == 200:
            rejected_requisition = reject_response.json()["data"]
            print(f"    ✅ 驳回申请成功")
            print(f"        审批状态: {rejected_requisition['approval_status']}")
            print(f"        驳回原因: {rejected_requisition['rejection_reason']}")
        else:
            print(f"    ❌ 驳回申请失败: {reject_response.text}")

    print("\n" + "=" * 80)
    print("✅ 所有测试完成!")
    print("=" * 80)


if __name__ == "__main__":
    try:
        test_visit_and_gift_apis()
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
