import urllib.request
import io
import os
import json
import numpy as np
import pandas as pd
from scipy import io as spio
from scipy import signal
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

print("Starting pipeline test...")
