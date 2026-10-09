"""Recovery tests for the single-dipole fit in ``source_localize.py``.

The script runs in Pyodide, but its fit is plain NumPy/SciPy, so these tests load it with CPython and
check it against dipoles of known position and moment simulated through an MNE sphere model on the 19
channels of a clinical 10-20 recording. They exist because the fit was once validated by looking at
the plot, which passed while the scan ignored the pattern's shape and the plot labelled the fitted
position as the negative pole: a model whose dipoles happened to sit under the dominant peak hid both.

Run from the interface directory with any Python environment that has numpy, scipy, matplotlib and mne:

    python -m pytest tests/python
"""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import mne
import numpy as np
import pytest

SCRIPT = Path(__file__).resolve().parents[2] / 'src/app/modules/eeg/scripts/source_localize.py'
CHANNELS = [
    'Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz',
    'C4', 'T8', 'P7', 'P3', 'Pz', 'P4', 'P8', 'O1', 'O2',
]
CENTER = np.array([0.0, 0.0, 0.04])
GRID_MM = 10.0


@pytest.fixture(scope='module')
def script():
    spec = importlib.util.spec_from_file_location('source_localize', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope='module')
def forward():
    """Free-orientation gain (n_ch, n_src, 3) and source positions, as the platform computes them."""
    info = mne.create_info(CHANNELS, sfreq=256.0, ch_types='eeg')
    info.set_montage(mne.channels.make_standard_montage('standard_1020'))
    sphere = mne.make_sphere_model(r0=tuple(CENTER), head_radius=0.09, verbose=False)
    src = mne.setup_volume_source_space(
        subject=None, pos=GRID_MM, sphere=(*CENTER, 0.09), sphere_units='m', mindist=5.0, verbose=False,
    )
    with np.errstate(all='ignore'):
        fwd = mne.make_forward_solution(
            info, mne.Transform('head', 'mri'), src, sphere, eeg=True, meg=False, mindist=5.0, verbose=False,
        )
    gain = fwd['sol']['data']
    pos = fwd['src'][0]['rr'][fwd['src'][0]['inuse'].astype(bool)]
    keep = np.isfinite(gain).all(axis=0).reshape(-1, 3).all(axis=1)
    keep &= np.linalg.norm(pos - CENTER, axis=1) > 1e-9
    gain = gain[:, np.repeat(keep, 3)].reshape(len(CHANNELS), -1, 3)
    return gain, pos[keep]


def _spike(n_times=64):
    """A surface-negative spike shape: the moment's sign is carried by the moment, this is the envelope."""
    t = np.linspace(-1, 1, n_times)
    return np.exp(-(t / 0.15) ** 2)


def _simulate(gain, k, moment, reference=None, noise=0.02, seed=0):
    """Scalp data for a dipole at source ``k``, optionally re-referenced to one channel, with white noise."""
    clean = np.outer(gain[:, k, :] @ moment, _spike())
    rng = np.random.default_rng(seed)
    data = clean + noise * np.abs(clean).max() * rng.standard_normal(clean.shape)
    if reference is not None:
        data = data - data[CHANNELS.index(reference)]
    return data


def _info():
    info = mne.create_info(CHANNELS, sfreq=256.0, ch_types='eeg')
    info.set_montage(mne.channels.make_standard_montage('standard_1020'))
    return info


def _fit(script, data, lead_field, src_pos, n_orient, polarity='negative'):
    # The window is centred on the cursor, as the tool builds it.
    script._src_loc.update(
        evoked=SimpleNamespace(data=data), lead_field=lead_field, src_pos=src_pos, info=_info(),
        n_orient=n_orient, method='dipole', dipole_polarity=polarity, sfreq=256.0, tmin=-(data.shape[1] // 2) / 256.0,
    )
    result = script.src_compute_source()
    assert result['success'], result
    return script._src_loc['dipole_pos'], script._src_loc['dipole_ori'], script._src_loc['dipole_gof']


def _source_near(src_pos, target):
    return int(np.argmin(np.linalg.norm(src_pos - np.asarray(target), axis=1)))


def _radial(p):
    return (p - CENTER) / np.linalg.norm(p - CENTER)


# Superficial left temporal, superficial right frontal and a deep midline source.
SOURCES = [(-0.06, -0.01, 0.04), (0.03, 0.05, 0.08), (0.0, -0.01, 0.05)]


@pytest.mark.parametrize('target', SOURCES)
@pytest.mark.parametrize('kind', ['inward', 'tangential'])
@pytest.mark.parametrize('reference', [None, 'Cz', 'O2'])
def test_free_orientation_recovers_position_and_moment(script, forward, target, kind, reference):
    gain, src_pos = forward
    k = _source_near(src_pos, target)
    radial = _radial(src_pos[k])
    if kind == 'inward':
        moment = -radial
    else:
        tangent = np.cross(radial, [0.0, 0.0, 1.0] if abs(radial[2]) < 0.9 else [1.0, 0.0, 0.0])
        moment = tangent / np.linalg.norm(tangent)
    data = _simulate(gain, k, 1e-8 * moment, reference=reference)
    lead_field = gain.reshape(gain.shape[0], -1)
    pos, ori, gof = _fit(script, data, lead_field, src_pos, 3)
    assert np.linalg.norm(pos - src_pos[k]) <= GRID_MM * 1.01e-3, (pos, src_pos[k])
    assert float(ori @ moment) > 0.95, (ori, moment)
    assert gof > 0.9


@pytest.mark.parametrize('target', SOURCES[:2])
def test_free_orientation_ignores_the_polarity_setting(script, forward, target):
    gain, src_pos = forward
    k = _source_near(src_pos, target)
    data = _simulate(gain, k, -1e-8 * _radial(src_pos[k]))
    lead_field = gain.reshape(gain.shape[0], -1)
    neg = _fit(script, data, lead_field, src_pos, 3, 'negative')
    pos = _fit(script, data, lead_field, src_pos, 3, 'positive')
    np.testing.assert_allclose(neg[0], pos[0])
    np.testing.assert_allclose(neg[1], pos[1])


@pytest.mark.parametrize('target', SOURCES[:2])
@pytest.mark.parametrize('reference', [None, 'Cz'])
def test_fixed_orientation_recovers_a_surface_negative_source(script, forward, target, reference):
    gain, src_pos = forward
    radial = (src_pos - CENTER) / np.linalg.norm(src_pos - CENTER, axis=1, keepdims=True)
    lead_field = np.einsum('cni,ni->cn', gain, radial)
    k = _source_near(src_pos, target)
    data = _simulate(gain, k, -1e-8 * radial[k], reference=reference)
    pos, ori, gof = _fit(script, data, lead_field, src_pos, 1, 'negative')
    assert np.linalg.norm(pos - src_pos[k]) <= GRID_MM * 1.01e-3, (pos, src_pos[k])
    assert float(ori @ radial[k]) < -0.99, 'the moment of a surface-negative source points inward'
    assert gof > 0.9


def test_fixed_orientation_positive_constraint_points_outward(script, forward):
    gain, src_pos = forward
    radial = (src_pos - CENTER) / np.linalg.norm(src_pos - CENTER, axis=1, keepdims=True)
    lead_field = np.einsum('cni,ni->cn', gain, radial)
    k = _source_near(src_pos, SOURCES[0])
    data = _simulate(gain, k, -1e-8 * radial[k])
    pos, ori, _ = _fit(script, data, lead_field, src_pos, 1, 'positive')
    j = _source_near(src_pos, pos)
    assert float(ori @ radial[j]) > 0.99
    assert not np.allclose(pos, src_pos[k]), 'a surface-negative source cannot satisfy the positive constraint'


def _angle_deg(a, b):
    a, b = a - CENTER, b - CENTER
    return float(np.degrees(np.arccos(np.clip(a @ b / np.linalg.norm(a) / np.linalg.norm(b), -1, 1))))


@pytest.mark.parametrize('target', SOURCES)
def test_negative_maximum_lies_on_the_cortex_above_an_inward_source(script, forward, target):
    gain, src_pos = forward
    k = _source_near(src_pos, target)
    _fit(script, _simulate(gain, k, -1e-8 * _radial(src_pos[k])), gain.reshape(gain.shape[0], -1), src_pos, 3)
    point = script._src_loc['cortex_negative']
    assert abs(np.linalg.norm(point - CENTER) - script._CORTEX_RADIUS) < 1e-9
    assert _angle_deg(point, src_pos[k]) < 12.0


def test_negative_maximum_lies_on_the_negative_side_of_a_tangential_source(script, forward):
    gain, src_pos = forward
    k = _source_near(src_pos, SOURCES[0])
    radial = _radial(src_pos[k])
    moment = np.cross(radial, [0.0, 0.0, 1.0])
    moment /= np.linalg.norm(moment)
    _fit(script, _simulate(gain, k, 1e-8 * moment), gain.reshape(gain.shape[0], -1), src_pos, 3)
    point = script._src_loc['cortex_negative']
    assert float((point - src_pos[k]) @ moment) < 0, 'the negative maximum is behind the moment'


@pytest.mark.parametrize('electrode', ['T7', 'F4', 'O1'])
def test_nearest_electrode_names_the_one_over_the_source(script, forward, electrode):
    gain, src_pos = forward
    # 2 cm under the electrode, in the head frame the recording's info places it in.
    over = _info().get_montage().get_positions()['ch_pos'][electrode]
    k = _source_near(src_pos, CENTER + (script._CORTEX_RADIUS - 0.02) * _radial(over))
    lead_field = gain.reshape(gain.shape[0], -1)
    _fit(script, _simulate(gain, k, -1e-8 * _radial(src_pos[k])), lead_field, src_pos, 3)
    result = script.src_compute_source()
    assert result['nearest_electrode'] == electrode
    assert len(result['cortex_negative_mm']) == 3


@pytest.mark.parametrize('mode', ['2d', '3d'])
def test_both_dipole_plots_render(script, forward, monkeypatch, mode):
    gain, src_pos = forward
    k = _source_near(src_pos, SOURCES[1])
    _fit(script, _simulate(gain, k, -1e-8 * _radial(src_pos[k])), gain.reshape(gain.shape[0], -1), src_pos, 3)
    drawn = []
    monkeypatch.setattr(script, '_draw_fig_to_canvas', lambda fig, canvas: drawn.append(fig))
    script._src_loc.update(source_canvas=object(), topomap_canvas=None, plot_mode=mode)
    assert script.src_plot()['success']
    assert len(drawn) == 1


def test_the_fit_follows_the_spike_at_the_cursor_not_the_window_background(script, forward):
    """A two-second window around a left spike, carrying a stronger right-sided rhythm throughout."""
    gain, src_pos = forward
    sfreq, half = 256.0, 1.0
    n = int(2 * half * sfreq)
    t = np.arange(n) / sfreq - half
    positions = _info().get_montage().get_positions()['ch_pos']
    left = _source_near(src_pos, CENTER + 0.06 * _radial(positions['T7']))
    right = _source_near(src_pos, CENTER + 0.06 * _radial(positions['C4']))
    spike = np.exp(-(t / 0.02) ** 2)                    # at the window centre, where the cursor is
    rhythm = np.sin(2 * np.pi * 10 * t)                 # alpha-like, all window long
    data = (np.outer(gain[:, left, :] @ (-1e-8 * _radial(src_pos[left])), spike)
            + np.outer(gain[:, right, :] @ (-1e-8 * _radial(src_pos[right])), 0.6 * rhythm))
    _fit(script, data, gain.reshape(gain.shape[0], -1), src_pos, 3)
    assert script._src_loc['nearest_electrode'] == 'T7'
    assert script._src_loc['cortex_negative'][0] < 0, 'the negative maximum is on the left'
