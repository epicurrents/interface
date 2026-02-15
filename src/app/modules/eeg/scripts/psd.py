import numpy as np
from scipy import signal, fft
import json

def psd_welch_periodogram():
    """
    Compute the Power Spectral Density (PSD) of the EEG signals using Welch's method and the periodogram method.

    Parameters
    ----------
    Parameters required to be present from JS side:

    data : list
        EEG signals samples for each channel in the montage.
    fs : float
        Sampling frequency of the EEG signals.

    Returns
    -------
    str
        JSON string containing the PSD of the EEG signals using Welch's method and the periodogram method.
    """
    from js import data, fs
    channels = []
    pfs = 0
    for d in data:
        w = signal.windows.hamming(int(fs*2))
        sig = np.asarray(d.to_py())
        pfs, Pxx_den = signal.welch(sig, fs, w)
        channels.append(Pxx_den.tolist())
    return json.dumps({ "fs": pfs.tolist(),  "channels": channels })

def psd_squared_fft_coeffs():
    """
    Compute the squared Fast Fourier Transform (FFT) coefficients of the EEG signals.

    Parameters
    ----------
    Parameters required to be present from JS side:

    data : list
        EEG signals samples for each channel in the montage.
    win_len : float
        Length of the window in seconds.

    Returns
    -------
    str
        JSON string containing the squared FFT coefficients of the EEG signals.
    """
    from js import data, win_len
    sqr_coeffs = []
    sig = None
    for d in data:
        if win_len and d.fs:
            py_sig = d.signal.to_py()
            sig = np.asarray(py_sig)[0:min(d.fs*win_len, len(py_sig))]
        else:
            sig = np.asarray(d.signal.to_py())
        fft_coeffs = abs(fft.rfft(sig))
        fs_bins = fft.rfftfreq(sig.size, 1/d.fs)
        sqr_coeffs.append({
            "coeffs": (fft_coeffs**2).tolist(),
            "frequencies": fs_bins.tolist(),
        })
    return json.dumps(sqr_coeffs)
