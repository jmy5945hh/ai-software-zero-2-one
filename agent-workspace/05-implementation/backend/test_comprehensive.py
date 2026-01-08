"""P0 阶段全面测试脚本
包含: 认证、权限、数据隔离、错误场景、业务流程测试
"""
import requests
import json
from datetime import datetime, date
from typing import Dict, List, Tuple

BASE_URL = "http://localhost:8000"

# 测试结果记录
test_results = []


def record_test(test_id: str, test_name: str, passed: bool, message: str = ""):
    """记录测试结果"""
    result = {
        "test_id": test_id,
        "test_name": test_name,
        "passed": passed,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {test_id}: {test_name}")
    if message:
        print(f"       {message}")


def login(username: str, password: str) -> Tuple[str, Dict]:
    """登录并返回 token 和用户信息"""
    response = requests.post(
        f"{BASE_URL}/api/v1/login",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        data = response.json()["data"]
        return data["access_token"], data["user"]
    return None, None


def get_headers(token: str) -> Dict:
    """获取请求头"""
    return {"Authorization": f"Bearer {token}"}


def test_01_authentication():
    """测试认证功能"""
    print("\n" + "=" * 80)
    print("T-01: 认证功能测试")
    print("=" * 80)

    # AC-002: 登录失败时系统给出明确提示
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "wrong_user", "password": "wrong_password"}
    )
    record_test(
        "AC-002",
        "登录失败提示",
        response.status_code == 401,
        f"状态码: {response.status_code}, 预期: 401"
    )

    # AC-003: 登录成功后进入系统首页
    token, user = login("cm001", "password123")
    record_test(
        "AC-003",
        "登录成功",
        token is not None and user is not None,
        f"用户: {user['name'] if user else 'None'}"
    )

    # AC-004: 未登录用户无法访问任何业务页面
    response = requests.get(f"{BASE_URL}/api/v1/visits")
    record_test(
        "AC-004",
        "未登录访问受保护资源",
        response.status_code == 401,
        f"状态码: {response.status_code}, 预期: 401"
    )

    # 获取当前用户信息
    if token:
        response = requests.get(
            f"{BASE_URL}/api/v1/me",
            headers=get_headers(token)
        )
        record_test(
            "AUTH-01",
            "获取当前用户信息",
            response.status_code == 200,
            f"用户: {response.json().get('data', {}).get('name', 'N/A')}"
        )

    return token, user


def test_02_visit_management(token: str, user: Dict):
    """测试拜访管理功能"""
    print("\n" + "=" * 80)
    print("T-02: 拜访管理功能测试")
    print("=" * 80)

    # AC-011: 客户经理可新增客户拜访记录
    visit_data = {
        "customer_id": "CUST_TEST_001",
        "company_name": "测试科技股份有限公司",
        "planned_date": "2026-01-20",
        "actual_date": "2026-01-20",
        "visit_method": "ON_SITE",
        "interested_products": ["理财产品A", "基金产品B"],
        "participants": [user["user_id"]],
        "status": "NEW",
        "notes": "测试拜访记录"
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/visits",
        json=visit_data,
        headers=get_headers(token)
    )

    visit_id = None
    if response.status_code == 200:
        visit_id = response.json()["data"]["visit_id"]

    record_test(
        "AC-011",
        "新增拜访记录",
        response.status_code == 200 and visit_id is not None,
        f"拜访ID: {visit_id or 'N/A'}"
    )

    # AC-012: 系统自动记录创建人信息
    if visit_id:
        response = requests.get(
            f"{BASE_URL}/api/v1/visits/{visit_id}",
            headers=get_headers(token)
        )
        if response.status_code == 200:
            visit = response.json()["data"]
            record_test(
                "AC-012",
                "自动记录创建人",
                visit.get("create_by") == user["user_id"],
                f"创建人: {visit.get('create_by')}"
            )

    # AC-013: 必填字段校验
    response = requests.post(
        f"{BASE_URL}/api/v1/visits",
        json={"company_name": "测试公司"},  # 缺少必填字段
        headers=get_headers(token)
    )
    record_test(
        "AC-013",
        "必填字段校验",
        response.status_code == 422,
        f"状态码: {response.status_code}, 预期: 422"
    )

    # AC-015: 已创建记录支持编辑
    if visit_id:
        update_data = {"status": "IN_PROGRESS", "notes": "拜访进行中"}
        response = requests.put(
            f"{BASE_URL}/api/v1/visits/{visit_id}",
            json=update_data,
            headers=get_headers(token)
        )
        record_test(
            "AC-015",
            "编辑拜访记录",
            response.status_code == 200,
            f"更新后状态: {response.json().get('data', {}).get('status', 'N/A')}"
        )

    # AC-016: 不支持物理删除记录
    response = requests.delete(
        f"{BASE_URL}/api/v1/visits/{visit_id}",
        headers=get_headers(token)
    )
    record_test(
        "AC-016",
        "不支持物理删除",
        response.status_code == 405,
        f"状态码: {response.status_code}, 预期: 405"
    )

    # AC-017: 支持按时间区间查询
    response = requests.get(
        f"{BASE_URL}/api/v1/visits?planned_date_start=2026-01-01&planned_date_end=2026-01-31",
        headers=get_headers(token)
    )
    record_test(
        "AC-017",
        "按时间区间查询",
        response.status_code == 200,
        f"记录数: {response.json().get('data', {}).get('total', 'N/A')}"
    )

    # AC-018: 支持按营销状态筛选
    response = requests.get(
        f"{BASE_URL}/api/v1/visits?status=NEW",
        headers=get_headers(token)
    )
    record_test(
        "AC-018",
        "按营销状态筛选",
        response.status_code == 200,
        f"NEW状态记录数: {response.json().get('data', {}).get('total', 'N/A')}"
    )

    return visit_id


def test_03_gift_management(token: str, user: Dict, visit_id: str):
    """测试礼品管理功能"""
    print("\n" + "=" * 80)
    print("T-03: 礼品管理功能测试")
    print("=" * 80)

    # 查询可用礼品
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts",
        headers=get_headers(token)
    )

    gift_id = None
    if response.status_code == 200:
        gifts = response.json()["data"]["items"]
        if gifts:
            gift_id = gifts[0]["gift_id"]

    # AC-022: 客户经理可填写并提交礼品申请
    requisition_data = {
        "recipient": user["user_id"],
        "gift_items": [{"gift_id": gift_id, "quantity": 2}],
        "planned_date": "2026-01-25",
        "purpose_type": "CUSTOMER_VISIT",
        "related_visit_id": visit_id
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        json=requisition_data,
        headers=get_headers(token)
    )

    requisition_id = None
    if response.status_code == 200:
        requisition_id = response.json()["data"]["requisition_id"]

    record_test(
        "AC-022",
        "提交礼品申请",
        response.status_code == 200 and requisition_id is not None,
        f"申请ID: {requisition_id or 'N/A'}"
    )

    # AC-023: 提交后申请状态变为"待审批"
    if requisition_id:
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/applications/{requisition_id}",
            headers=get_headers(token)
        )
        if response.status_code == 200:
            requisition = response.json()["data"]
            record_test(
                "AC-023",
                "申请状态为待审批",
                requisition.get("approval_status") == "PENDING",
                f"状态: {requisition.get('approval_status')}"
            )

    # AC-024: 提交后不可修改申请内容
    if requisition_id:
        response = requests.put(
            f"{BASE_URL}/api/v1/auth/gifts/applications/{requisition_id}",
            json={"recipient": user["user_id"]},
            headers=get_headers(token)
        )
        record_test(
            "AC-024",
            "提交后不可修改",
            response.status_code == 422,
            f"状态码: {response.status_code}, 预期: 422"
        )

    # AC-025: 客户经理可查看本人申请列表
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        headers=get_headers(token)
    )
    record_test(
        "AC-025",
        "查看个人申请列表",
        response.status_code == 200,
        f"申请数: {response.json().get('data', {}).get('total', 'N/A')}"
    )

    return requisition_id


def test_04_approval_workflow(requisition_id: str):
    """测试审批流程"""
    print("\n" + "=" * 80)
    print("T-04: 审批流程测试")
    print("=" * 80)

    # 审批人员登录
    approver_token, approver = login("approver001", "password123")
    if not approver_token:
        record_test("APPROVER-01", "审批人员登录", False, "登录失败")
        return

    # AC-027: 审批人员可查看所有待审批申请
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts/approvals/pending",
        headers=get_headers(approver_token)
    )
    record_test(
        "AC-027",
        "查看待审批申请",
        response.status_code == 200,
        f"待审批数: {response.json().get('data', {}).get('total', 'N/A')}"
    )

    # AC-028: 审批人员可选择通过或驳回
    # 测试通过
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id}/approve",
        json={"comment": "审批通过，符合规定"},
        headers=get_headers(approver_token)
    )
    record_test(
        "AC-028",
        "审批通过",
        response.status_code == 200,
        f"状态: {response.json().get('data', {}).get('approval_status', 'N/A')}"
    )

    # 创建另一个申请用于测试驳回
    cm_token, cm_user = login("cm001", "password123")
    response = requests.get(f"{BASE_URL}/api/v1/auth/gifts", headers=get_headers(cm_token))
    gift_id = response.json()["data"]["items"][0]["gift_id"]

    requisition_data_2 = {
        "recipient": cm_user["user_id"],
        "gift_items": [{"gift_id": gift_id, "quantity": 10}],
        "planned_date": "2026-01-30",
        "purpose_type": "OTHER"
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/applications",
        json=requisition_data_2,
        headers=get_headers(cm_token)
    )

    if response.status_code == 200:
        requisition_id_2 = response.json()["data"]["requisition_id"]

        # AC-029: 驳回时必须填写原因
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id_2}/reject",
            json={},  # 未填写原因
            headers=get_headers(approver_token)
        )
        record_test(
            "AC-029",
            "驳回必须填写原因",
            response.status_code == 422,
            f"状态码: {response.status_code}, 预期: 422"
        )

        # 正常驳回
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id_2}/reject",
            json={"rejection_reason": "数量过多，不符合规定"},
            headers=get_headers(approver_token)
        )
        record_test(
            "AC-028-2",
            "审批驳回",
            response.status_code == 200,
            f"状态: {response.json().get('data', {}).get('approval_status', 'N/A')}"
        )

    # AC-030: 审批完成后状态不可变更
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/gifts/approvals/{requisition_id}/approve",
        json={"comment": "重复审批"},
        headers=get_headers(approver_token)
    )
    record_test(
        "AC-030",
        "审批完成后不可变更",
        response.status_code == 422,
        f"状态码: {response.status_code}, 预期: 422"
    )

    # AC-031: 展示所有已审批礼品记录
    ops_token, ops_user = login("operations001", "password123")
    if ops_token:
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/ledger",
            headers=get_headers(ops_token)
        )
        record_test(
            "AC-031",
            "查看礼品台账",
            response.status_code == 200,
            f"台账记录数: {response.json().get('data', {}).get('total', 'N/A')}"
        )


def test_05_rbac_permissions():
    """测试基于角色的权限控制"""
    print("\n" + "=" * 80)
    print("T-05: RBAC权限控制测试")
    print("=" * 80)

    # 测试客户经理权限
    cm_token, cm_user = login("cm001", "password123")

    # AC-007: 功能入口根据用户角色动态展示
    # 客户经理可以访问拜访记录
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/visits",
        headers=get_headers(cm_token)
    )
    record_test(
        "RBAC-01",
        "客户经理访问拜访记录",
        response.status_code == 200,
        "客户经理应该可以访问拜访记录"
    )

    # 客户经理不应该能访问礼品台账（仅运营和管理员可访问）
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts/ledger",
        headers=get_headers(cm_token)
    )
    record_test(
        "RBAC-02",
        "客户经理无法访问礼品台账",
        response.status_code == 403,
        f"状态码: {response.status_code}, 预期: 403"
    )

    # 测试运营人员权限
    ops_token, ops_user = login("operations001", "password123")
    if ops_token:
        # 运营人员可以访问礼品台账
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/ledger",
            headers=get_headers(ops_token)
        )
        record_test(
            "RBAC-03",
            "运营人员访问礼品台账",
            response.status_code == 200,
            "运营人员应该可以访问礼品台账"
        )

    # 测试审批人员权限
    approver_token, approver = login("approver001", "password123")
    if approver_token:
        # 审批人员可以访问待审批列表
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/approvals/pending",
            headers=get_headers(approver_token)
        )
        record_test(
            "RBAC-04",
            "审批人员访问待审批列表",
            response.status_code == 200,
            "审批人员应该可以访问待审批列表"
        )

    # 测试管理员权限（全部权限）
    manager_token, manager = login("manager001", "password123")
    if manager_token:
        # 管理员可以访问所有功能
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/ledger",
            headers=get_headers(manager_token)
        )
        can_access_ledger = response.status_code == 200

        response = requests.get(
            f"{BASE_URL}/api/v1/auth/gifts/approvals/pending",
            headers=get_headers(manager_token)
        )
        can_access_approvals = response.status_code == 200

        record_test(
            "RBAC-05",
            "管理员全部权限",
            can_access_ledger and can_access_approvals,
            "管理员应该可以访问所有功能"
        )


def test_06_data_level_permissions():
    """测试数据级权限控制"""
    print("\n" + "=" * 80)
    print("T-06: 数据级权限控制测试")
    print("=" * 80)

    # AC-014: 客户经理仅可查看本人创建的记录
    # 客户经理1创建拜访记录
    cm1_token, cm1_user = login("cm001", "password123")
    visit_data = {
        "customer_id": "CUST_ISOLATION_TEST",
        "company_name": "数据隔离测试公司",
        "planned_date": "2026-01-20",
        "visit_method": "ON_SITE",
        "participants": [cm1_user["user_id"]],
        "status": "NEW"
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/visits",
        json=visit_data,
        headers=get_headers(cm1_token)
    )

    visit_id = None
    if response.status_code == 200:
        visit_id = response.json()["data"]["visit_id"]

    # 客户经理1可以查看自己创建的记录
    if visit_id:
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/visits/{visit_id}",
            headers=get_headers(cm1_token)
        )
        can_access_own = response.status_code == 200

        # 客户经理2尝试访问客户经理1创建的记录
        cm2_token, cm2_user = login("cm002", "password123")
        response = requests.get(
            f"{BASE_URL}/api/v1/auth/visits/{visit_id}",
            headers=get_headers(cm2_token)
        )
        cannot_access_others = response.status_code == 403

        record_test(
            "AC-014",
            "客户经理数据隔离",
            can_access_own and cannot_access_others,
            f"本人可访问: {can_access_own}, 他人不可访问: {cannot_access_others}"
        )


def test_07_error_scenarios():
    """测试错误场景"""
    print("\n" + "=" * 80)
    print("T-07: 错误场景测试")
    print("=" * 80)

    token, user = login("cm001", "password123")

    # 测试 401: 未登录
    response = requests.get(f"{BASE_URL}/api/v1/auth/visits")
    record_test(
        "ERR-01",
        "401 未认证",
        response.status_code == 401,
        f"状态码: {response.status_code}"
    )

    # 测试 403: 权限不足
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/gifts/ledger",
        headers=get_headers(token)
    )
    record_test(
        "ERR-02",
        "403 权限不足",
        response.status_code == 403,
        f"状态码: {response.status_code}"
    )

    # 测试 400: 无效数据
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/visits",
        json={"invalid_field": "invalid_value"},
        headers=get_headers(token)
    )
    record_test(
        "ERR-03",
        "400 无效数据",
        response.status_code == 422,
        f"状态码: {response.status_code}"
    )

    # 测试 404: 资源不存在
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/visits/NON_EXISTENT_ID",
        headers=get_headers(token)
    )
    record_test(
        "ERR-04",
        "404 资源不存在",
        response.status_code == 404,
        f"状态码: {response.status_code}"
    )


def generate_test_report():
    """生成测试报告"""
    print("\n" + "=" * 80)
    print("测试报告")
    print("=" * 80)

    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    pass_rate = (passed / total * 100) if total > 0 else 0

    print(f"\n总测试用例: {total}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"通过率: {pass_rate:.1f}%")

    if failed > 0:
        print("\n失败的测试用例:")
        for result in test_results:
            if not result["passed"]:
                print(f"  - {result['test_id']}: {result['test_name']}")
                print(f"    {result['message']}")

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": pass_rate,
        "results": test_results
    }


def main():
    """主测试函数"""
    print("\n" + "=" * 80)
    print("招财银行北京分行运营门户系统 - P0 阶段全面测试")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"后端服务: {BASE_URL}")

    try:
        # 1. 认证功能测试
        token, user = test_01_authentication()

        if not token:
            print("\n❌ 认证测试失败，终止后续测试")
            return

        # 2. 拜访管理测试
        visit_id = test_02_visit_management(token, user)

        # 3. 礼品管理测试
        requisition_id = test_03_gift_management(token, user, visit_id)

        # 4. 审批流程测试
        test_04_approval_workflow(requisition_id)

        # 5. RBAC权限测试
        test_05_rbac_permissions()

        # 6. 数据级权限测试
        test_06_data_level_permissions()

        # 7. 错误场景测试
        test_07_error_scenarios()

        # 8. 生成测试报告
        report = generate_test_report()

        # 9. 保存测试报告到文件
        report_file = "/Users/jingmengyuan/code/for-cc-and-glm/ai-software-zero-2-one/agent-workspace/05-implementation/backend/test_results.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 测试报告已保存到: {report_file}")

    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
