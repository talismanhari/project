import urllib.request, json, numpy as np

cost_matrix = np.array([
    [0.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0],
    [10.0, 0.0,  2.0,  2.5,  2.5,  4.0,  4.0,  4.0],
    [10.0, 3.0,  0.0,  3.0,  3.0,  5.0,  5.0,  5.0],
    [10.0, 2.5,  3.0,  0.0,  3.0,  5.0,  5.0,  5.0],
    [10.0, 2.5,  3.0,  3.0,  0.0,  5.0,  5.0,  5.0],
    [10.0, 6.0,  7.0,  6.0,  6.0,  0.0,  2.5,  2.5],
    [10.0, 6.0,  7.0,  6.0,  6.0,  2.5,  0.0,  2.5],
    [10.0, 6.0,  7.0,  6.0,  6.0,  2.5,  2.5,  0.0]
])

# If state is "Severe Fault (Transitional)" or "Outer Race Fault" with ambiguous transient harmonics:
# Let's inspect what logits produce min risk >= 1.20
# e.g., if logits for Inner Race (5) and Outer Race (6) are close:
l1 = [0.1, -1.0, -1.2, -1.0, -1.5, 2.8, 3.1, -0.5]
s = np.array(l1) / 1.45
p = np.exp(s - np.max(s)) / np.sum(np.exp(s - np.max(s)))
r = p @ cost_matrix
print("P:", [round(x, 3) for x in p])
print("Risk vector:", [round(x, 3) for x in r])
print("Min Risk:", min(r))
