"""
EEG source localization in Pyodide (browser-side).

Supported methods
-----------------
'sloreta'  — standardised LORETA (sLORETA)
'eloreta'  — exact LORETA (eLORETA)
'dspm'     — dynamic statistical parametric mapping
'mne'      — minimum-norm estimate (no noise normalisation)
'dipole'   — single equivalent dipole, scanned over the source grid

Architecture note
-----------------
MNE's forward-model computation (`make_forward_solution`) relies on compiled
C code from MNE-C and cannot run in Pyodide.  The lead field matrix (forward
solution) must therefore be pre-computed server-side — once per standard
montage — and passed into the script as a flat typed array.  Everything else
(inverse computation and all visualisation) is pure NumPy/SciPy/MNE and runs
entirely in the browser.

Usage (from the JS/TS side)
----------------------------
1.  Load the script once (it defines all functions in Pyodide's global
    namespace).
2.  Call setup functions in order:
        src_set_montage()      — JS param: montage_name (str)
        src_set_channels()     — JS params: channels (JSON array), sfreq (float)
        src_set_lead_field()   — JS params: lead_field, src_pos, n_channels,
                                             n_sources, n_orient
        src_set_method()           — JS param: method (str, optional — default 'sloreta')
        src_set_snr()              — JS param: snr (float, optional — default 3.0)
        src_set_source_canvas()    — JS param: canvas (CanvasElement | OffscreenCanvas)
        src_set_topomap_canvas()   — JS param: canvas (CanvasElement | OffscreenCanvas)
3.  For each analysis:
        src_set_epochs()       — JS params: epochs (flat Float32Array),
                                             n_epochs, n_channels, n_times, tmin
        src_compute_evoked()   — averages epochs → mne.EvokedArray
        src_compute_source()   — runs the chosen inverse method
        src_plot()             — draws result onto registered canvas elements
4.  Optionally call src_get_epoch_data() for a JSON dump of epochs + average.

All functions return {'success': bool, ...}.  On error they include 'error'.
"""

import json

import matplotlib
matplotlib.use('Agg')
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib import pyplot as plt
from matplotlib.patches import Circle
import mne
import numpy as np
from scipy import linalg

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

_src_loc = {
    'method': 'dipole',    # str — 'sloreta' | 'eloreta' | 'dspm' | 'mne' | 'dipole'
    'dipole_polarity': 'negative',  # str — 'negative' | 'positive'; constrains fixed-orientation fits only
    'info': None,          # mne.Info
    'montage': None,       # mne.channels.DigMontage
    'lead_field': None,    # ndarray (n_channels, n_sources * n_orient)
    'src_pos': None,       # ndarray (n_sources, 3) — source positions in metres
    'n_orient': 1,         # int — 1 (fixed) or 3 (free orientation)
    'epochs': None,        # ndarray (n_epochs, n_channels, n_times)
    'evoked': None,        # mne.EvokedArray
    'stc_data': None,      # ndarray (n_sources, n_times)
    'dipole_pos': None,    # ndarray (3,) — fitted dipole position (metres)
    'dipole_ori': None,    # ndarray (3,) — fitted dipole orientation (unit vector)
    'dipole_gof': None,    # float — goodness of fit [0, 1]
    'cortex_negative': None,   # ndarray (3,) — cortical point of the dipole's negative maximum (metres)
    'nearest_electrode': None, # str — recording electrode closest in direction to that point
    'dipole_peak_idx': None,   # int — sample of the window the dipole was fitted at
    'sfreq': 256.0,        # float — sampling frequency
    'tmin': -0.1,          # float — epoch start time in seconds
    'snr': 3.0,            # float — assumed SNR (used to compute λ²)
    'fig_width': 8.0,      # float — figure width in inches
    'fig_height': 4.0,     # float — figure height in inches
    'plot_mode': '2d',     # str — '2d' (three orthogonal projections) | '3d' (three viewpoints)
    'source_canvas': None, # JS canvas element for the main source plot
    'topomap_canvas': None, # JS canvas element for the scalp topomap
}

# The spherical head model the lead fields are computed with (the server's forward model defaults),
# and its brain surface: MNE's default four-shell sphere puts the brain at 0.90 of the head radius.
_SPHERE_CENTER = np.array([0.0, 0.0, 0.04])     # metres, head coordinates
_HEAD_RADIUS = 0.09                             # metres
_CORTEX_RADIUS = 0.90 * _HEAD_RADIUS            # metres

# A dipole is fitted to the discharge at the cursor, not to the whole analysis window: the field-power
# peak is searched for this far either side of the window centre, and the fit spans this far either
# side of that peak.
_SPIKE_SEARCH_S = 0.05                          # seconds
_FIT_HALF_WIDTH_S = 0.01                        # seconds

# ---------------------------------------------------------------------------
# Setup functions
# ---------------------------------------------------------------------------

def src_set_montage():
    """
    Set the standard EEG montage by name.

    JS params
    ---------
    montage_name : str
        Name recognised by ``mne.channels.make_standard_montage()``,
        e.g. ``'standard_1020'``, ``'biosemi64'``, ``'GSN-HydroCel-256'``.
    """
    from js import montage_name
    _src_loc['montage'] = mne.channels.make_standard_montage(montage_name)
    return {'success': True}


def src_set_channels():
    """
    Create ``mne.Info`` from channel names and sampling rate.
    Must be called *after* ``src_set_montage()`` if a montage is used.

    JS params
    ---------
    channels : str
        JSON-encoded list of EEG channel names, e.g. ``'["Fp1","Fp2",...]'``.
    sfreq : float
        Sampling rate in Hz.
    """
    from js import channels, sfreq
    ch_names = json.loads(channels)
    info = mne.create_info(ch_names=ch_names, sfreq=float(sfreq), ch_types='eeg')
    if _src_loc['montage'] is not None:
        info.set_montage(_src_loc['montage'])
    _src_loc['info'] = info
    _src_loc['sfreq'] = float(sfreq)
    return {'success': True}


def src_set_method():
    """
    Select the source localisation method.

    JS params
    ---------
    method : str
        One of ``'sloreta'``, ``'eloreta'``, ``'dspm'``, ``'mne'``,
        ``'dipole'``.  Default is ``'sloreta'``.
    """
    from js import method
    valid = ('sloreta', 'eloreta', 'dspm', 'mne', 'dipole')
    if method not in valid:
        return {
            'success': False,
            'error': f"Unknown method '{method}'. Valid options: {valid}.",
        }
    _src_loc['method'] = method
    return {'success': True}


def src_set_dipole_polarity():
    """
    Choose the surface polarity a fixed-orientation dipole fit is constrained to.

    JS params
    ---------
    polarity : str
        ``'negative'`` (default) — only sources whose radial moment points
        inward at the peak are candidates, so the scalp directly over the
        fitted source is negative.  This is the clinical convention for
        epileptiform discharges.

        ``'positive'`` — only sources whose radial moment points outward.

    The setting has no effect on a free-orientation lead field: there the
    moment's direction, and with it which pole faces the surface, is fitted
    from the data.
    """
    from js import polarity
    if str(polarity) not in ('negative', 'positive'):
        return {'success': False, 'error': "polarity must be 'negative' or 'positive'."}
    _src_loc['dipole_polarity'] = str(polarity)
    return {'success': True}


def src_set_lead_field():
    """
    Supply the pre-computed lead field matrix and source grid.

    The lead field encodes the sensitivity of each EEG electrode to each
    source location (and, for free-orientation sources, each orientation).
    It must be computed server-side using e.g. MNE's
    ``make_forward_solution()`` and passed here as a typed array.

    JS params
    ---------
    lead_field : Float64Array
        Flat, row-major buffer of length ``n_channels * n_sources * n_orient``.
        Shape after reshaping: ``(n_channels, n_sources * n_orient)``.
    src_pos : Float64Array
        Flat buffer of length ``n_sources * 3``, in metres.
        Shape after reshaping: ``(n_sources, 3)``.
    n_channels : int
        Number of EEG channels (must match the info set by ``src_set_channels``).
    n_sources : int
        Number of source grid points.
    n_orient : int
        ``1`` for fixed-orientation (usually surface normals), ``3`` for
        free-orientation (x, y, z components per source).
    """
    from js import lead_field, src_pos, n_channels, n_sources, n_orient
    n_ch = int(n_channels)
    n_src = int(n_sources)
    n_ori = int(n_orient)
    # .to_py() converts the JsProxy (Float64Array) to a Python memoryview,
    # which np.frombuffer accepts without an extra copy.
    lf = np.frombuffer(lead_field.to_py(), dtype=np.float64).reshape(n_ch, n_src * n_ori)
    sp = np.frombuffer(src_pos.to_py(), dtype=np.float64).reshape(n_src, 3)
    _src_loc['lead_field'] = lf
    _src_loc['src_pos'] = sp
    _src_loc['n_orient'] = n_ori
    return {'success': True}


def src_set_snr():
    """
    Set the assumed signal-to-noise ratio for Tikhonov regularisation.

    JS params
    ---------
    snr : float
        SNR value (default ``3.0``).  Regularisation parameter is
        ``λ² = 1 / snr²``.  Increase for noisy data; lower values
        produce sharper but noisier solutions.
    """
    from js import snr
    _src_loc['snr'] = float(snr)
    return {'success': True}


def src_set_source_canvas():
    """
    Set the canvas element for the main source plot (3-view scatter or dipole).

    JS params
    ---------
    canvas : CanvasElement | OffscreenCanvas
        The canvas to draw the source localisation result onto.
    width : int, optional
        Desired figure width in pixels (converted to inches at 100 dpi).
        When omitted, the current fig_width is unchanged.
    height : int, optional
        Desired figure height in pixels.
    """
    from js import canvas
    _src_loc['source_canvas'] = canvas
    try:
        from js import width, height
        _src_loc['fig_width'] = int(width) / 100.0
        _src_loc['fig_height'] = int(height) / 100.0
    except Exception:
        pass
    return {'success': True}


def src_set_topomap_canvas():
    """
    Set the canvas element for the scalp topomap plot.

    JS params
    ---------
    canvas : CanvasElement | OffscreenCanvas
    """
    from js import canvas
    _src_loc['topomap_canvas'] = canvas
    return {'success': True}


def src_set_plot_mode():
    """
    Select the source-plot rendering style.

    JS params
    ---------
    mode : str
        ``'2d'`` — three orthogonal scatter projections (axial / coronal / sagittal).
        ``'3d'`` — three matplotlib 3D scatter viewpoints (superior / anterior / lateral)
                   with a transparent head-sphere wireframe for spatial reference.
        Default is ``'2d'``.
    """
    from js import mode
    _src_loc['plot_mode'] = '3d' if str(mode) == '3d' else '2d'
    return {'success': True}


def src_set_epochs():
    """
    Supply the epoch array.

    JS params
    ---------
    epochs : Float32Array
        Flat, row-major buffer of shape ``(n_epochs, n_channels, n_times)``.
        Values should be in SI units (Volts).
    n_epochs : int
    n_channels : int
    n_times : int
        Number of time samples per epoch.
    tmin : float
        Start time of each epoch in seconds (e.g. ``-0.1`` for 100 ms pre-stimulus).
    """
    from js import epochs, n_epochs, n_channels, n_times, tmin
    data = (
        np.frombuffer(epochs.to_py(), dtype=np.float32)
        .reshape(int(n_epochs), int(n_channels), int(n_times))
        .astype(np.float64)
    )
    _src_loc['epochs'] = data
    _src_loc['tmin'] = float(tmin)
    return {'success': True}


# ---------------------------------------------------------------------------
# Computation
# ---------------------------------------------------------------------------

def src_compute_evoked():
    """
    Average all epochs into an ``mne.EvokedArray``.
    Must be called after ``src_set_epochs()`` and ``src_set_channels()``.
    """
    epochs = _src_loc['epochs']
    info = _src_loc['info']
    if epochs is None:
        return {'success': False, 'error': 'Epochs not set. Call src_set_epochs() first.'}
    if info is None:
        return {'success': False, 'error': 'Channel info not set. Call src_set_channels() first.'}
    avg = epochs.mean(axis=0)                      # (n_channels, n_times)
    evoked = mne.EvokedArray(avg, info, tmin=_src_loc['tmin'])
    if _src_loc['montage'] is not None:
        evoked.set_montage(_src_loc['montage'])
    _src_loc['evoked'] = evoked
    return {'success': True, 'n_epochs': int(epochs.shape[0])}


def src_compute_source():
    """
    Run source localisation on the evoked average.

    Must be called after both ``src_compute_evoked()`` and
    ``src_set_lead_field()``.

    Returns summary statistics for the caller to inspect before plotting.
    """
    L = _src_loc['lead_field']
    evoked = _src_loc['evoked']
    n_orient = _src_loc['n_orient']
    method = _src_loc['method']
    snr = _src_loc['snr']
    src_pos = _src_loc['src_pos']

    if L is None:
        return {'success': False, 'error': 'Lead field not set. Call src_set_lead_field() first.'}
    if evoked is None:
        return {'success': False, 'error': 'Evoked not computed. Call src_compute_evoked() first.'}

    # Average reference, applied to both over the same channels. The lead field gives potentials
    # against infinity and the data whatever reference the recording used; any common reference is
    # a per-sample offset across channels, which re-referencing both removes. Left in, it is a
    # pattern no source produces, and every fit is skewed towards explaining it.
    M = _average_reference(evoked.data)            # (n_channels, n_times)
    L = _average_reference(L)
    n_ch, n_src_ori = L.shape
    n_src = n_src_ori // n_orient
    lam2 = 1.0 / (snr ** 2)

    if method == 'dipole':
        if src_pos is None:
            return {'success': False, 'error': 'src_pos required for dipole fitting.'}
        peak = _spike_peak_index(M)
        reach = max(1, int(round(_FIT_HALF_WIDTH_S * _src_loc['sfreq'])))
        pos, ori, gof = _fit_single_dipole(M[:, max(0, peak - reach):peak + reach + 1], L, n_src, n_orient, src_pos)
        _src_loc['dipole_peak_idx'] = peak
        electrodes = _electrode_positions()
        cortex_neg = _cortical_negative_maximum(pos, ori, electrodes)
        nearest = _nearest_electrode(cortex_neg, electrodes)
        _src_loc['dipole_pos'] = pos
        _src_loc['dipole_ori'] = ori
        _src_loc['dipole_gof'] = float(gof)
        _src_loc['cortex_negative'] = cortex_neg
        _src_loc['nearest_electrode'] = nearest
        return {
            'success': True,
            'dipole_pos_mm': (pos * 1000.0).tolist(),
            'dipole_ori': ori.tolist(),
            'cortex_negative_mm': (cortex_neg * 1000.0).tolist(),
            'nearest_electrode': nearest,
            'dipole_gof_pct': round(float(gof) * 100.0, 1),
            'peak_time_s': round(float(_src_loc['tmin'] + peak / _src_loc['sfreq']), 4),
        }
    else:
        stc = _compute_distributed_inverse(M, L, lam2, method, n_src, n_orient)
        _src_loc['stc_data'] = stc
        peak_time_idx = int(np.argmax(np.abs(stc).mean(axis=0)))
        peak_time_s = float(_src_loc['tmin'] + peak_time_idx / _src_loc['sfreq'])
        peak_source_idx = int(np.argmax(np.abs(stc[:, peak_time_idx])))
        peak_source_pos = (
            (src_pos[peak_source_idx] * 1000.0).tolist()
            if src_pos is not None else None
        )
        return {
            'success': True,
            'n_sources': n_src,
            'n_times': int(stc.shape[1]),
            'peak_time_s': round(peak_time_s, 4),
            'peak_source_pos_mm': peak_source_pos,
        }


def _spike_peak_index(M):
    """
    The sample of the field-power peak nearest the window centre, where the cursor is.

    Searched only ``_SPIKE_SEARCH_S`` either side of the centre.  A window
    long enough to show a discharge in context carries far more background
    than discharge, and its strongest pattern or its largest sample is as
    likely to be ongoing rhythm or artefact anywhere in it: fitting that
    locates the same background around every spike.  The centre comes from
    ``tmin``, the window's start relative to the cursor.
    """
    sfreq = _src_loc['sfreq']
    n = M.shape[1]
    centre = min(max(int(round(-_src_loc['tmin'] * sfreq)), 0), n - 1)
    reach = max(1, int(round(_SPIKE_SEARCH_S * sfreq)))
    lo, hi = max(0, centre - reach), min(n, centre + reach + 1)
    power = np.sqrt((M[:, lo:hi] ** 2).mean(axis=0))
    return lo + int(np.argmax(power))


def _average_reference(X):
    """Subtract the across-channel mean (axis 0) from every column of ``X``."""
    return X - X.mean(axis=0, keepdims=True)


def _compute_distributed_inverse(M, L, lam2, method, n_src, n_orient):
    """
    Compute a distributed source estimate.

    Implements the regularised pseudo-inverse:

        W = L^T (L L^T + λ² I)^{-1}
        J = W M

    with noise normalisation for sLORETA / eLORETA / dSPM.

    Parameters
    ----------
    M : ndarray (n_ch, n_times)
    L : ndarray (n_ch, n_src * n_orient)
    lam2 : float  — Tikhonov regularisation parameter
    method : str
    n_src : int
    n_orient : int  — 1 or 3

    Returns
    -------
    stc : ndarray (n_src, n_times)
    """
    n_ch = L.shape[0]
    A = L @ L.T + lam2 * np.eye(n_ch)
    A_inv = linalg.inv(A)
    W = L.T @ A_inv                                # (n_src * n_orient, n_ch)
    J = W @ M                                      # (n_src * n_orient, n_times)

    if n_orient == 3:
        # Power across x/y/z orientations — result is (n_src, n_times)
        J3 = J.reshape(n_src, 3, -1)
        J = np.sqrt((J3 ** 2).sum(axis=1))

    if method == 'mne':
        return J

    # Noise normalisation — diagonal of resolution matrix R = W L per source.
    # Only the diagonal is needed, so use einsum instead of the full O(n_src²)
    # matrix product: einsum('ij,ji->i', W, L) computes sum_k W[i,k]*L[k,i]
    # in O(n_src * n_ch) without allocating a (n_src × n_src) intermediate.
    if n_orient == 1:
        diag_R = np.einsum('ij,ji->i', W, L)
        noise_norm = np.maximum(np.sqrt(np.abs(diag_R)), 1e-30)
        if method == 'dspm':
            # dSPM uses the noise-norm from the identity noise cov
            ww_diag = np.maximum(np.sqrt(np.einsum('ij,ij->i', W, W)), 1e-30)
            return J / ww_diag[:, np.newaxis]
        # sLORETA / eLORETA
        return J / noise_norm[:, np.newaxis]
    else:
        # Free orientation: per-source 3×3 resolution matrix → trace / 3
        noise_norm = np.ones(n_src)
        for k in range(n_src):
            Wk = W[k * 3:(k + 1) * 3, :]          # (3, n_ch)
            Lk = L[:, k * 3:(k + 1) * 3]          # (n_ch, 3)
            Rk = Wk @ Lk                           # (3, 3) resolution matrix slice
            noise_norm[k] = max(np.sqrt(np.trace(Rk) / 3.0), 1e-30)
        return J / noise_norm[:, np.newaxis]


def _fit_single_dipole(M, L, n_src, n_orient, src_pos):
    """
    Fit a single equivalent dipole by scanning the source grid.

    The scan fits the dominant spatial pattern of the window — the first left
    singular vector of ``M`` — at every grid position and keeps the position
    whose lead field explains the largest share of it.  The share is a
    correlation, so it depends on the shape of a lead field and not on its
    size: ranking by raw projection instead favours whichever positions sit
    closest to the electrodes, regardless of fit.  For a free-orientation lead
    field the share is the cosine between the pattern and its projection onto
    the source's three-column span; for a fixed one it is the cosine with the
    single column.

    The pattern's sign is arbitrary, so the dipole's direction comes from the
    data instead: the moment is fitted at the window's peak (largest root-mean-
    square across channels), and ``ori`` points along it, from the negative to
    the positive pole.

    A fixed-orientation scan honours ``dipole_polarity``: ``'negative'`` keeps
    only the sources whose fitted radial moment points inward at the peak, so
    the surface over the source is negative, and ``'positive'`` the reverse.
    A free-orientation fit takes the direction from the data alone.

    Parameters
    ----------
    M : ndarray (n_ch, n_times)       — average-referenced data
    L : ndarray (n_ch, n_src * n_orient) — average-referenced lead field
    n_src : int
    n_orient : int
    src_pos : ndarray (n_src, 3)

    Returns
    -------
    pos : ndarray (3,)      — dipole position (metres)
    ori : ndarray (3,)      — unit moment direction, negative pole to positive pole
    gof : float             — goodness of fit of the dipole's time course [0, 1]
    """
    U, _, _ = linalg.svd(M, full_matrices=False)
    pattern = U[:, 0]                                    # (n_ch,), unit norm
    peak = int(np.argmax(np.sqrt((M ** 2).mean(axis=0))))
    m_peak = M[:, peak]

    if n_orient == 3:
        gains = L.reshape(L.shape[0], n_src, 3).transpose(1, 0, 2)   # (n_src, n_ch, 3)
        Q, _ = np.linalg.qr(gains)                       # orthonormal basis of each span
        share = np.linalg.norm(np.einsum('kci,c->ki', Q, pattern), axis=1)
        best = int(np.argmax(share))
        Lk = gains[best]                                 # (n_ch, 3)
        moment, *_ = linalg.lstsq(Lk, m_peak)            # (3,), moment at the peak
        ori = moment / (linalg.norm(moment) + 1e-30)
        L_dip = Lk @ ori
    else:
        norms = linalg.norm(L, axis=0) + 1e-30
        share = np.abs(L.T @ pattern) / norms
        # The radial moment each source would need at the peak; its sign is the polarity.
        radial_moment = (L.T @ m_peak) / norms ** 2
        want_negative = _src_loc.get('dipole_polarity', 'negative') == 'negative'
        allowed = radial_moment < 0 if want_negative else radial_moment > 0
        if not allowed.any():
            allowed = np.ones(n_src, dtype=bool)
        best = int(np.argmax(np.where(allowed, share, -np.inf)))
        radial = src_pos[best] - _SPHERE_CENTER
        radial = radial / (linalg.norm(radial) + 1e-30)
        sign = 1.0 if radial_moment[best] >= 0 else -1.0
        ori = sign * radial
        L_dip = sign * L[:, best]

    pos = src_pos[best].copy()

    # Goodness of fit: 1 − ‖M − L_dip a^T‖² / ‖M‖², with a the least-squares time course.
    LtL = float(L_dip @ L_dip) + 1e-30
    amplitudes = (L_dip @ M) / LtL                       # (n_times,)
    M_fit = np.outer(L_dip, amplitudes)
    residual_power = float(linalg.norm(M - M_fit) ** 2)
    total_power = float(linalg.norm(M) ** 2) + 1e-30
    gof = max(0.0, 1.0 - residual_power / total_power)

    return pos, ori, gof


def _electrode_positions():
    """Head-coordinate positions (metres) of the recording's channels, by name; empty without a montage."""
    info = _src_loc['info']
    montage = info.get_montage() if info is not None else None
    if montage is None:
        return {}
    return {name: np.asarray(p) for name, p in montage.get_positions()['ch_pos'].items()
            if name in info.ch_names and p is not None and np.all(np.isfinite(p))}


def _fibonacci_sphere(n):
    """``n`` near-uniformly spaced unit vectors."""
    i = np.arange(n) + 0.5
    polar = np.arccos(1.0 - 2.0 * i / n)
    azimuth = np.pi * (1.0 + 5.0 ** 0.5) * i
    return np.column_stack([np.cos(azimuth) * np.sin(polar), np.sin(azimuth) * np.sin(polar), np.cos(polar)])


def _cortical_negative_maximum(pos, ori, electrodes=None, n_points=6000):
    """
    The point on the head model's cortical surface where the fitted dipole's potential is most negative.

    This is where a clinical reading places the source: the cortex under the
    negative peak.  A single equivalent dipole fitted to an extended discharge
    often lands deeper than the cortex that produced it, and from a deep
    position the direction of a short arrow says little about where on the
    surface it points; the potential the dipole produces on the cortical
    shell says it exactly.  The potential is the dipole's primary term,
    ``ori·(r − pos) / |r − pos|³``, which dominates near the source and
    needs no conductivity model.  For a superficial dipole pointing inward
    the point lies directly above it; for a deep or tangential one, where its
    negative side meets the cortex.

    The surface is searched only as low as the electrodes reach, less a
    centimetre, because nothing below them is measured.
    """
    points = _SPHERE_CENTER + _CORTEX_RADIUS * _fibonacci_sphere(n_points)
    if electrodes:
        floor = min(p[2] for p in electrodes.values()) - 0.01
        points = points[points[:, 2] >= floor]
    offset = points - pos
    dist = np.linalg.norm(offset, axis=1)
    usable = dist > 1e-3
    potential = np.full(len(points), np.inf)
    potential[usable] = (offset[usable] @ ori) / dist[usable] ** 3
    return points[int(np.argmin(potential))].copy()


def _nearest_electrode(point, electrodes):
    """The electrode whose direction from the sphere centre is closest to ``point``'s, or None."""
    if not electrodes:
        return None
    target = (point - _SPHERE_CENTER) / linalg.norm(point - _SPHERE_CENTER)
    names = list(electrodes)
    dirs = np.array([electrodes[n] - _SPHERE_CENTER for n in names])
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    return names[int(np.argmax(dirs @ target))]


# ---------------------------------------------------------------------------
# Plotting helpers
# ---------------------------------------------------------------------------

def _draw_fig_to_canvas(fig, canvas):
    """
    Render a matplotlib figure directly onto a JS canvas element via
    ``putImageData``.  Faster than base64 round-tripping because there is no
    encoding / decoding step and the pixel data is written straight into the
    canvas backing store.

    The canvas ``width`` and ``height`` properties are updated to match the
    rendered figure dimensions.
    """
    from js import ImageData, Uint8ClampedArray
    agg = FigureCanvasAgg(fig)
    agg.draw()
    w, h = agg.get_width_height()
    rgba = np.frombuffer(agg.buffer_rgba(), dtype=np.uint8)
    canvas.width = w
    canvas.height = h
    ctx = canvas.getContext('2d')
    img = ImageData.new(Uint8ClampedArray.new(rgba.tobytes()), w, h)
    ctx.putImageData(img, 0, 0)


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def src_plot():
    """
    Draw the source localisation result directly onto the registered canvas
    elements (set via ``src_set_source_canvas`` and ``src_set_topomap_canvas``).

    Both canvases are optional individually — whichever are set will be drawn.
    At least one must be set for the call to do anything useful.

    Returns ``{'success': bool}`` (plus ``'error'`` on failure).
    """
    if _src_loc['source_canvas'] is None and _src_loc['topomap_canvas'] is None:
        return {
            'success': False,
            'error': 'No canvas registered. Call src_set_source_canvas() and/or src_set_topomap_canvas() first.',
        }
    mode_3d = _src_loc['plot_mode'] == '3d'
    if _src_loc['method'] == 'dipole':
        return _plot_dipole_3d() if mode_3d else _plot_dipole()
    else:
        return _plot_loreta_3d() if mode_3d else _plot_loreta()


def _draw_scalp_topomap(evoked, time_idx):
    """Draw the scalp topomap at ``time_idx`` onto ``_src_loc['topomap_canvas']``."""
    canvas = _src_loc['topomap_canvas']
    if canvas is None:
        return
    fw = _src_loc['fig_width']
    fh = _src_loc['fig_height']
    fig, ax = plt.subplots(figsize=(fw * 0.45, fh))
    mne.viz.plot_topomap(
        evoked.data[:, time_idx],
        evoked.info,
        axes=ax,
        show=False,
    )
    t_ms = int(round((_src_loc['tmin'] + time_idx / _src_loc['sfreq']) * 1000))
    ax.set_title(f'Scalp topo ({t_ms} ms)')
    _draw_fig_to_canvas(fig, canvas)
    plt.close(fig)


def _plot_loreta():
    """
    Draw three orthogonal scatter-plot views (axial / coronal / sagittal) of
    the distributed source power at peak latency onto ``source_canvas``, and
    the scalp topomap at the same latency onto ``topomap_canvas``.
    """
    evoked = _src_loc['evoked']
    stc = _src_loc['stc_data']
    src_pos = _src_loc['src_pos']
    if evoked is None or stc is None or src_pos is None:
        return {'success': False, 'error': 'Source data not available. Call src_compute_source() first.'}

    method = _src_loc['method'].upper()
    fw = _src_loc['fig_width']
    fh = _src_loc['fig_height']

    peak_idx = int(np.argmax(np.abs(stc).mean(axis=0)))
    peak_power = stc[:, peak_idx]
    vmax = float(np.abs(peak_power).max()) or 1.0

    # --- Scalp topomap ---
    _draw_scalp_topomap(evoked, peak_idx)

    # --- Source power: 3 orthogonal projections ---
    source_canvas = _src_loc['source_canvas']
    if source_canvas is None:
        return {'success': True}

    dim_pairs = [(0, 1), (0, 2), (1, 2)]
    axis_labels = [(_AXIS_LABEL[0], _AXIS_LABEL[1]),
                   (_AXIS_LABEL[0], _AXIS_LABEL[2]),
                   (_AXIS_LABEL[1], _AXIS_LABEL[2])]
    view_titles = ['Axial', 'Coronal', 'Sagittal']
    sp_mm = src_pos * 1000.0                       # convert metres → millimetres

    fig, axes = plt.subplots(2, 2, figsize=(fw, fw), constrained_layout=True)
    sc = None
    for ax, title, (d0, d1), (xl, yl) in zip(axes.flat, view_titles, dim_pairs, axis_labels):
        sc = ax.scatter(
            sp_mm[:, d0],
            sp_mm[:, d1],
            c=peak_power,
            cmap='RdBu_r',
            vmin=-vmax,
            vmax=vmax,
            s=8,
            alpha=0.85,
            linewidths=0,
        )
        ax.set_xlabel(xl)
        ax.set_ylabel(yl)
        ax.set_aspect('equal')
        ax.set_title(title)

    # Use an inset axes centred in the 4th cell so the colorbar is self-contained
    # and does not steal space from or affect the three neighbouring subplots.
    from mpl_toolkits.axes_grid1.inset_locator import inset_axes as _inset_axes
    axes[1, 1].axis('off')
    if sc is not None:
        cax = _inset_axes(axes[1, 1], width='18%', height='75%', loc='center')
        fig.colorbar(sc, cax=cax, label=method)
    _draw_fig_to_canvas(fig, source_canvas)
    plt.close(fig)

    return {'success': True}


def _plot_dipole():
    """
    Draw three orthogonal views showing the fitted dipole position and
    orientation inside a head silhouette onto ``source_canvas``, and the
    scalp topomap at peak latency onto ``topomap_canvas``.
    """
    evoked = _src_loc['evoked']
    pos = _src_loc['dipole_pos']
    ori = _src_loc['dipole_ori']
    gof = _src_loc['dipole_gof']
    src_pos = _src_loc['src_pos']

    if evoked is None or pos is None:
        return {'success': False, 'error': 'Dipole not fitted. Call src_compute_source() first.'}

    fw = _src_loc['fig_width']
    fh = _src_loc['fig_height']

    # Peak latency of the evoked
    _draw_scalp_topomap(evoked, _src_loc['dipole_peak_idx'])

    source_canvas = _src_loc['source_canvas']
    if source_canvas is None:
        return {'success': True}

    sp_mm = src_pos * 1000.0 if src_pos is not None else None
    pos_mm = pos * 1000.0
    neg_mm = _src_loc['cortex_negative'] * 1000.0
    ctr_mm = _SPHERE_CENTER * 1000.0
    head_r_mm = _HEAD_RADIUS * 1000.0
    cortex_r_mm = _CORTEX_RADIUS * 1000.0

    dim_pairs = [(0, 1), (0, 2), (1, 2)]
    axis_labels = [(_AXIS_LABEL[0], _AXIS_LABEL[1]),
                   (_AXIS_LABEL[0], _AXIS_LABEL[2]),
                   (_AXIS_LABEL[1], _AXIS_LABEL[2])]
    view_titles = ['Axial', 'Coronal', 'Sagittal']
    arrow_mm = 15.0   # length of the arrow towards the dipole's negative pole

    fig, axes = plt.subplots(2, 2, figsize=(fw, fw), constrained_layout=True)
    for ax, title, (d0, d1), (xl, yl) in zip(axes.flat, view_titles, dim_pairs, axis_labels):
        # Head and cortical surface of the model, centred on its sphere.
        centre = (ctr_mm[d0], ctr_mm[d1])
        ax.add_patch(Circle(centre, head_r_mm, fill=False, color='black', linewidth=1.5, zorder=1))
        ax.add_patch(Circle(centre, cortex_r_mm, fill=False, color='gray', linewidth=0.8,
                            linestyle='--', zorder=1))

        # Background source grid
        if sp_mm is not None:
            ax.scatter(
                sp_mm[:, d0], sp_mm[:, d1],
                s=2, color='#cccccc', alpha=0.5, zorder=2, linewidths=0,
            )

        # The dipole, with a short arrow towards its negative pole: `ori` is the physical moment
        # direction, − to +, so the arrow runs along −ori.
        ax.annotate(
            '',
            xy=(pos_mm[d0] - ori[d0] * arrow_mm, pos_mm[d1] - ori[d1] * arrow_mm),
            xytext=(pos_mm[d0], pos_mm[d1]),
            arrowprops=dict(arrowstyle='->', color='darkred', lw=1.5),
            zorder=6,
        )
        ax.scatter([pos_mm[d0]], [pos_mm[d1]], s=30, color='black',
                   marker='o', zorder=7, label='dipole')
        # The cortical point of its negative maximum, the result a reading is after.
        ax.plot([pos_mm[d0], neg_mm[d0]], [pos_mm[d1], neg_mm[d1]],
                color='steelblue', linewidth=1.0, linestyle=':', zorder=5)
        ax.scatter([neg_mm[d0]], [neg_mm[d1]], s=160, color='steelblue', edgecolors='black',
                   linewidths=1.0, marker='o', zorder=8, label='negative maximum')

        lim = head_r_mm * 1.15
        ax.set_xlim(ctr_mm[d0] - lim, ctr_mm[d0] + lim)
        ax.set_ylim(ctr_mm[d1] - lim, ctr_mm[d1] + lim)
        ax.set_aspect('equal')
        ax.set_xlabel(xl)
        ax.set_ylabel(yl)
        ax.set_title(title)

    # 4th cell: GOF text + legend.
    gof_pct = round(float(gof) * 100.0, 1) if gof is not None else 0.0
    ax4 = axes[1, 1]
    ax4.axis('off')
    ax4.text(0.5, 0.6, _dipole_caption(gof_pct), ha='center', va='center',
             fontsize=14, transform=ax4.transAxes)
    handles, labels = axes.flat[0].get_legend_handles_labels()
    if handles:
        ax4.legend(handles, labels, loc='lower center', fontsize=8)
    _draw_fig_to_canvas(fig, source_canvas)
    plt.close(fig)
    return {'success': True}


# ---------------------------------------------------------------------------
# 3-D plotting helpers
# ---------------------------------------------------------------------------

def _dipole_caption(gof_pct):
    """The dipole result's text cell: goodness of fit, and the electrode over the negative maximum."""
    nearest = _src_loc.get('nearest_electrode')
    caption = f'GOF\n{gof_pct} %'
    return f'{caption}\n\nNeg. max.\nnear {nearest}' if nearest else caption


def _head_sphere_wireframe(ax, radius_mm=_HEAD_RADIUS * 1000.0):
    """Add a faint wireframe of the head model's sphere to a 3-D axes as a spatial reference."""
    cx, cy, cz = _SPHERE_CENTER * 1000.0
    u = np.linspace(0, 2 * np.pi, 18)
    v = np.linspace(0, np.pi, 10)
    xs = cx + radius_mm * np.outer(np.cos(u), np.sin(v))
    ys = cy + radius_mm * np.outer(np.sin(u), np.sin(v))
    zs = cz + radius_mm * np.outer(np.ones_like(u), np.cos(v))
    ax.plot_wireframe(xs, ys, zs, alpha=0.06, color='gray',
                      linewidth=0.4, rstride=2, cstride=2)


def _configure_3d_ax(ax, title, elev, azim):
    ax.view_init(elev=elev, azim=azim)
    ax.set_title(title, fontsize=8)
    ax.set_xlabel(_AXIS_LABEL[0], fontsize=5, labelpad=1)
    ax.set_ylabel(_AXIS_LABEL[1], fontsize=5, labelpad=1)
    ax.set_zlabel(_AXIS_LABEL[2], fontsize=5, labelpad=1)
    ax.tick_params(labelsize=4, pad=1)


# Axis orientation labels — suffix shows negative→positive direction.
# MNE head coordinates: x+ = Right, y+ = Anterior, z+ = Superior.
_AXIS_LABEL = {
    0: 'x  LR (mm)',   # Left → Right
    1: 'y  PA (mm)',   # Posterior → Anterior
    2: 'z  IS (mm)',   # Inferior → Superior
}

# Standard neurological viewpoints: (title, elevation, azimuth)
_VIEWPOINTS = [
    ('Superior',  90, 270),
    ('Anterior',   0, 270),
    ('Left',       0, 180),
]


def _plot_loreta_3d():
    """
    Three matplotlib 3-D scatter views of distributed source power at peak
    latency, each with a transparent head-sphere wireframe for reference.
    """
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 — registers projection
    evoked  = _src_loc['evoked']
    stc     = _src_loc['stc_data']
    src_pos = _src_loc['src_pos']
    if evoked is None or stc is None or src_pos is None:
        return {'success': False, 'error': 'Source data not available. Call src_compute_source() first.'}

    method   = _src_loc['method'].upper()
    fw, fh   = _src_loc['fig_width'], _src_loc['fig_height']
    peak_idx = int(np.argmax(np.abs(stc).mean(axis=0)))
    power    = stc[:, peak_idx]
    vmax     = float(np.abs(power).max()) or 1.0
    sp_mm    = src_pos * 1000.0

    _draw_scalp_topomap(evoked, peak_idx)

    source_canvas = _src_loc['source_canvas']
    if source_canvas is None:
        return {'success': True}

    fig = plt.figure(figsize=(fw, fw), layout='constrained')
    positions = [1, 2, 3]  # top-left, top-right, bottom-left of a 2×2 grid
    for pos, (title, elev, azim) in zip(positions, _VIEWPOINTS):
        ax = fig.add_subplot(2, 2, pos, projection='3d')
        _head_sphere_wireframe(ax)
        sc = ax.scatter(sp_mm[:, 0], sp_mm[:, 1], sp_mm[:, 2],
                        c=power, cmap='RdBu_r', vmin=-vmax, vmax=vmax,
                        s=6, alpha=0.85, linewidths=0, depthshade=True)
        _configure_3d_ax(ax, title, elev, azim)

    # 4th cell: narrow colorbar centred via inset_axes.
    from mpl_toolkits.axes_grid1.inset_locator import inset_axes as _inset_axes
    ax4 = fig.add_subplot(2, 2, 4)
    ax4.axis('off')
    cax = _inset_axes(ax4, width='18%', height='75%', loc='center')
    fig.colorbar(sc, cax=cax, label=method)
    _draw_fig_to_canvas(fig, source_canvas)
    plt.close(fig)
    return {'success': True}


def _plot_dipole_3d():
    """
    Three matplotlib 3-D views of the fitted dipole position and orientation
    inside a head-sphere wireframe, plus the scalp topomap at peak latency.
    """
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    evoked  = _src_loc['evoked']
    pos     = _src_loc['dipole_pos']
    ori     = _src_loc['dipole_ori']
    gof     = _src_loc['dipole_gof']
    src_pos = _src_loc['src_pos']
    if evoked is None or pos is None:
        return {'success': False, 'error': 'Dipole not fitted. Call src_compute_source() first.'}

    fw, fh    = _src_loc['fig_width'], _src_loc['fig_height']
    _draw_scalp_topomap(evoked, _src_loc['dipole_peak_idx'])

    source_canvas = _src_loc['source_canvas']
    if source_canvas is None:
        return {'success': True}

    dip_mm   = pos * 1000.0
    neg_mm   = _src_loc['cortex_negative'] * 1000.0
    arrow_mm = 15.0                         # length of the arrow towards the negative pole
    sp_mm    = src_pos * 1000.0 if src_pos is not None else None

    fig = plt.figure(figsize=(fw, fw), layout='constrained')
    positions = [1, 2, 3]
    for subplot_pos, (title, elev, azim) in zip(positions, _VIEWPOINTS):
        ax = fig.add_subplot(2, 2, subplot_pos, projection='3d')
        _head_sphere_wireframe(ax)

        if sp_mm is not None:
            ax.scatter(sp_mm[:, 0], sp_mm[:, 1], sp_mm[:, 2],
                       s=2, color='#cccccc', alpha=0.4, linewidths=0)

        # The dipole with a short arrow towards its negative pole (−ori; see _plot_dipole).
        ax.quiver(dip_mm[0], dip_mm[1], dip_mm[2],
                  -ori[0] * arrow_mm, -ori[1] * arrow_mm, -ori[2] * arrow_mm,
                  color='darkred', linewidth=1.5, arrow_length_ratio=0.3)
        ax.scatter([dip_mm[0]], [dip_mm[1]], [dip_mm[2]],
                   s=30, color='black', marker='o', zorder=7, label='dipole')
        # The cortical point of its negative maximum.
        ax.plot([dip_mm[0], neg_mm[0]], [dip_mm[1], neg_mm[1]], [dip_mm[2], neg_mm[2]],
                color='steelblue', linewidth=1.0, linestyle=':')
        ax.scatter([neg_mm[0]], [neg_mm[1]], [neg_mm[2]], s=160, color='steelblue',
                   edgecolors='black', linewidths=1.0, marker='o', zorder=8, label='negative maximum')

        _configure_3d_ax(ax, title, elev, azim)

    # 4th cell: GOF text.
    gof_pct = round(float(gof) * 100.0, 1) if gof is not None else 0.0
    ax4 = fig.add_subplot(2, 2, 4)
    ax4.axis('off')
    ax4.text(0.5, 0.5, _dipole_caption(gof_pct), ha='center', va='center',
             fontsize=14, transform=ax4.transAxes)
    _draw_fig_to_canvas(fig, source_canvas)
    plt.close(fig)
    return {'success': True}


# ---------------------------------------------------------------------------
# Data export
# ---------------------------------------------------------------------------

def src_get_epoch_data():
    """
    Return epoch data and evoked average as JSON-serialisable Python lists.

    NOTE: For large datasets prefer passing TypedArrays directly.  This
    function is intended for small previews or debugging.

    Returns
    -------
    {
        'success': bool,
        'epochs': [[[float]]]  — shape (n_epochs, n_channels, n_times),
        'average': [[float]]   — shape (n_channels, n_times),
        'n_epochs': int,
        'n_channels': int,
        'n_times': int,
        'tmin': float,
        'sfreq': float,
    }
    """
    epochs = _src_loc['epochs']
    if epochs is None:
        return {'success': False, 'error': 'No epoch data available.'}
    evoked = _src_loc['evoked']
    avg = evoked.data if evoked is not None else epochs.mean(axis=0)
    return {
        'success': True,
        'epochs': epochs.tolist(),
        'average': avg.tolist(),
        'n_epochs': int(epochs.shape[0]),
        'n_channels': int(epochs.shape[1]),
        'n_times': int(epochs.shape[2]),
        'tmin': float(_src_loc['tmin']),
        'sfreq': float(_src_loc['sfreq']),
    }
