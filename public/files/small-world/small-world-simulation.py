"""
小世界网络模拟：规则网络 -> 少量重连 -> 随机网络
用于《世界很大，世界很小》第四章"捷径"的实测数据。

模型：Watts-Strogatz (1998)
  N 个节点排成环，每个节点与左右各 K/2 个邻居相连，
  然后以概率 p 随机重连每条边。

指标：
  L(p) = 平均最短路径长度（全局，"世界有多大"）
  C(p) = 平均聚类系数（局部，"你的朋友圈有多抱团"）

运行：python3 小世界模拟.py
"""

import json
import networkx as nx

N = 1000        # 节点数（人）
K = 10          # 每个人的熟人数
TRIALS = 5      # 每个 p 重复次数，取平均
PS = [0.0, 1e-4, 1e-3, 3e-3, 1e-2, 3e-2, 1e-1, 3e-1, 1.0]


def measure(G):
    L = nx.average_shortest_path_length(G) if nx.is_connected(G) else _largest_cc_L(G)
    C = nx.average_clustering(G)
    return L, C


def _largest_cc_L(G):
    c = max(nx.connected_components(G), key=len)
    return nx.average_shortest_path_length(G.subgraph(c))


rows = []
base_L = base_C = None

for p in PS:
    Ls, Cs = [], []
    for seed in range(TRIALS):
        G = nx.watts_strogatz_graph(N, K, p, seed=seed * 7 + 1)
        L, C = measure(G)
        Ls.append(L)
        Cs.append(C)
    L = sum(Ls) / len(Ls)
    C = sum(Cs) / len(Cs)
    if p == 0.0:
        base_L, base_C = L, C
    rows.append({"p": p, "L": L, "C": C, "L_ratio": L / base_L, "C_ratio": C / base_C})

# 理论值对照
C_theory = 3 * (K - 2) / (4 * (K - 1))
L_theory = N / (2 * K)

# 找 L 掉到一半所需的 p
half_p = next((r["p"] for r in rows if r["L_ratio"] <= 0.5 and r["p"] > 0), None)

print(f"N={N}, K={K}, trials={TRIALS}")
print(f"理论 L(0)=N/(2K)={L_theory:.2f}   实测={base_L:.2f}")
print(f"理论 C(0)=3(K-2)/4(K-1)={C_theory:.4f}   实测={base_C:.4f}")
print()
print(f"{'p':>8} {'L':>8} {'L/L0':>7} {'C':>7} {'C/C0':>7}")
for r in rows:
    print(f"{r['p']:>8.4f} {r['L']:>8.2f} {r['L_ratio']:>7.3f} {r['C']:>7.4f} {r['C_ratio']:>7.3f}")
print()
print(f"L 首次降到规则网络一半时的 p = {half_p}")
print(f"此时 C/C0 = {next(r['C_ratio'] for r in rows if r['p'] == half_p):.3f}")

with open("小世界模拟结果.json", "w", encoding="utf-8") as f:
    json.dump({"N": N, "K": K, "TRIALS": TRIALS,
               "L_theory": L_theory, "C_theory": C_theory,
               "base_L": base_L, "base_C": base_C,
               "half_p": half_p, "rows": rows}, f, ensure_ascii=False, indent=2)

# ---- 出图（英文标签，避免中文字体缺失） ----
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ps = [r["p"] for r in rows if r["p"] > 0]
Lr = [r["L_ratio"] for r in rows if r["p"] > 0]
Cr = [r["C_ratio"] for r in rows if r["p"] > 0]

fig, ax = plt.subplots(figsize=(7.2, 4.4), dpi=160)
ax.plot(ps, Lr, "o-", label="L(p)/L(0)  mean path length", color="#1f77b4")
ax.plot(ps, Cr, "s-", label="C(p)/C(0)  clustering coefficient", color="#d62728")
ax.set_xscale("log")
ax.set_xlabel("rewiring probability p (log scale)")
ax.set_ylabel("normalized value")
ax.set_title(f"Watts-Strogatz small world, N={N}, K={K}, {TRIALS} trials each", fontsize=10)
ax.axhline(1.0, color="grey", lw=0.8, ls=":")
ax.grid(alpha=0.25, which="both")
ax.legend(fontsize=9)
fig.tight_layout()
fig.savefig("小世界模拟.png")
print("saved 小世界模拟.png")
