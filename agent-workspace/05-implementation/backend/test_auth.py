"""认证功能测试脚本"""
import requests
import json


BASE_URL = "http://localhost:8000"


def test_login():
    """测试登录"""
    print("=" * 50)
    print("测试 1: 用户登录")
    print("=" * 50)

    url = f"{BASE_URL}/api/v1/auth/login"
    data = {"username": "manager001", "password": "password123"}

    print(f"请求 URL: {url}")
    print(f"请求体: {json.dumps(data, indent=2)}")

    response = requests.post(url, json=data)

    print(f"\n响应状态码: {response.status_code}")
    print(f"响应体: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    if response.status_code == 200:
        result = response.json()
        token = result["data"]["access_token"]
        print(f"\n✓ 登录成功!")
        print(f"Token: {token[:50]}...")
        return token
    else:
        print(f"\n✗ 登录失败!")
        return None


def test_get_me(token):
    """测试获取当前用户信息"""
    print("\n" + "=" * 50)
    print("测试 2: 获取当前用户信息")
    print("=" * 50)

    url = f"{BASE_URL}/api/v1/auth/me"
    headers = {"Authorization": f"Bearer {token}"}

    print(f"请求 URL: {url}")
    print(f"请求头: Authorization: Bearer {token[:20]}...")

    response = requests.get(url, headers=headers)

    print(f"\n响应状态码: {response.status_code}")
    print(f"响应体: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    if response.status_code == 200:
        print(f"\n✓ 获取用户信息成功!")
    else:
        print(f"\n✗ 获取用户信息失败!")


def test_invalid_token():
    """测试无效 Token"""
    print("\n" + "=" * 50)
    print("测试 3: 无效 Token 访问")
    print("=" * 50)

    url = f"{BASE_URL}/api/v1/auth/me"
    headers = {"Authorization": "Bearer invalid_token_12345"}

    print(f"请求 URL: {url}")
    print(f"请求头: Authorization: Bearer invalid_token_12345")

    response = requests.get(url, headers=headers)

    print(f"\n响应状态码: {response.status_code}")
    print(f"响应体: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    if response.status_code == 401:
        print(f"\n✓ 正确拦截了无效 Token!")
    else:
        print(f"\n✗ 未正确拦截无效 Token!")


def test_wrong_password():
    """测试错误密码"""
    print("\n" + "=" * 50)
    print("测试 4: 错误密码登录")
    print("=" * 50)

    url = f"{BASE_URL}/api/v1/auth/login"
    data = {"username": "manager001", "password": "wrong_password"}

    print(f"请求 URL: {url}")
    print(f"请求体: {json.dumps(data, indent=2)}")

    response = requests.post(url, json=data)

    print(f"\n响应状态码: {response.status_code}")
    print(f"响应体: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    if response.status_code == 401:
        print(f"\n✓ 正确拒绝了错误密码!")
    else:
        print(f"\n✗ 未正确拒绝错误密码!")


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("招财银行北京分行运营门户系统 - 认证功能测试")
    print("=" * 50)
    print()

    try:
        # 测试登录
        token = test_login()

        if token:
            # 测试获取用户信息
            test_get_me(token)

            # 测试无效 Token
            test_invalid_token()

        # 测试错误密码
        test_wrong_password()

        print("\n" + "=" * 50)
        print("测试完成!")
        print("=" * 50)

    except requests.exceptions.ConnectionError:
        print("\n✗ 无法连接到服务器,请确保后端服务已启动")
        print("启动命令: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"\n✗ 测试出错: {e}")
