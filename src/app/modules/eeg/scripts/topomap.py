import numpy as np
from matplotlib import pyplot as plt
import json
import mne

# Set up variables
_topomap_fig_topomap, _topomap_ax_topomap = plt.subplots(
    ncols=2,
    gridspec_kw=dict(width_ratios=[19, 1], wspace=0, bottom=0.02, left=0, right=0.9, top=0.93)
)
_topomap_fig_series, _topomap_ax_series = plt.subplots(ncols=3, nrows=3)
_topomap_fig_average, _topomap_ax_average = plt.subplots(ncols=1, nrows=1)
_topomap = {
    'evoked': None,
    'fig_topomap': _topomap_fig_topomap,
    'ax_topomap': _topomap_ax_topomap,
    'fig_series': _topomap_fig_series,
    'ax_series': _topomap_ax_series,
    'fig_average': _topomap_fig_average,
    'ax_average': _topomap_ax_average,
    'info': None,
    'montage': None,
    'series_canvas': None,
    'topomap_canvas': None,
    'topomap_colorbar': True,
}

def topomap_draw_canvas ():
    """
    Draw the topomap and topomap propagation series at the given cursor index on the respective canvases.

    Using offscreen canvas to draw directly to the DOM has some drawbacks, which don't affect the current use case.
    See: https://blog.pyodide.org/posts/canvas-renderer-matplotlib-in-pyodide/.

    Parameters
    ----------
    Parameters required to be present from JS side:

    channel_indices : list
        Indices of the channels to mask in the topomap.
    colorbar : bool
        True if the colorbar is to be drawn on the topomap, False otherwise.
    cursor_time : float
        Time of the cursor position in seconds.
    mode : str
        Mode of the topomap propagation series, either 'avg' or 'dev'.
    span : int
        Time interval in milliseconds between each topomap in the topomap propagation series.

    Returns
    -------
    bool
        True if the topomap and topomap propagation series are successfully drawn on the canvases, False otherwise.
    """
    from js import ImageData, channel_indices, colorbar, cursor_time, mode, span
    from pyodide.ffi import create_proxy
    if _topomap['evoked'] is None:
        return False
    # Shift time to center samples at cursor position.
    _topomap['evoked'].shift_time(-cursor_time, relative=False)
    # Plot topomap.
    for ax in _topomap['ax_topomap']:
        ax.clear()
    # Remove the colorbar axis if it is disabled.
    _topomap['ax_topomap'][1].axis('on' if colorbar else 'off')
    # Set mask parameters.
    channel_mask = np.zeros(_topomap['evoked'].data.shape, dtype='bool')
    channel_mask[channel_indices, :] = True
    _topomap['evoked'].plot_topomap(
        0, # This cannot be made interactive, as the Pyodide mne.viz does not include ui_events.
        ch_type='eeg',
        axes=_topomap['ax_topomap'].flatten()[0:2 if colorbar else 1],
        colorbar=colorbar,
        cbar_fmt='%d',
        time_format='',
        mask=channel_mask,
        mask_params=dict(marker='o', markerfacecolor='w', markeredgecolor='k', linewidth=0, markersize=8),
        show=False
    )
    np_topo = np.frombuffer(_topomap['fig_topomap'].canvas.buffer_rgba(), dtype=np.uint8)
    topo_bytes = np_topo.tobytes()
    # Create a dataview of the buffer that can be accessed by JavaScript.
    topo_proxy = create_proxy(topo_bytes)
    topo_buffer = topo_proxy.getBuffer("u8clamped")
    topo_img = ImageData.new(topo_buffer.data, _topomap['topomap_canvas'].width, _topomap['topomap_canvas'].height)
    _topomap['topomap_canvas'].getContext('2d').putImageData(topo_img, 0, 0)
    # If time_interval is set to zero, only plot the topogram.
    if not span:
        return True
    # Plot topomap propagation series.
    series_span = span/1000
    if mode == 'avg':
        # Plot average topomap.
        _topomap['ax_average'].clear()
        _topomap['evoked'].plot_topomap(
            0,
            average=series_span,
            ch_type='eeg',
            axes=_topomap['ax_average'],
            colorbar=False,
            show=False
        )
        np_avg = np.frombuffer(_topomap['fig_average'].canvas.buffer_rgba(), dtype=np.uint8)
        avg_bytes = np_avg.tobytes()
        avg_proxy = create_proxy(avg_bytes)
        avg_buffer = avg_proxy.getBuffer("u8clamped")
        avg_img = ImageData.new(avg_buffer.data, _topomap['series_canvas'].width, _topomap['series_canvas'].height)
        _topomap['series_canvas'].getContext('2d').putImageData(avg_img, 0, 0)
        avg_proxy.destroy()
        avg_buffer.release()
    else:
        # Plot topomap propagation series.
        series_times = np.arange(-0.4*series_span, 0.45*series_span, series_span/10)
        for ax in _topomap['ax_series'].flatten():
            ax.clear()
        _topomap['evoked'].plot_topomap(
            series_times,
            ch_type='eeg',
            axes=_topomap['ax_series'].flatten(),
            colorbar=False,
            time_unit='ms',
            show=False
        )
        np_series = np.frombuffer(_topomap['fig_series'].canvas.buffer_rgba(), dtype=np.uint8)
        series_bytes = np_series.tobytes()
        series_proxy = create_proxy(series_bytes)
        series_buffer = series_proxy.getBuffer("u8clamped")
        series_img = ImageData.new(series_buffer.data, _topomap['series_canvas'].width, _topomap['series_canvas'].height)
        _topomap['series_canvas'].getContext('2d').putImageData(series_img, 0, 0)
        series_proxy.destroy()
        series_buffer.release()
    # Reset time shift.
    _topomap['evoked'].shift_time(0, relative=False)
    # Clean up.
    topo_proxy.destroy()
    topo_buffer.release()
    return True

def topomap_list_channels ():
    """
    List the channel names of the current EEG data.

    Returns
    -------
    str
        JSON string containing the channel names.
    """
    global info
    if info is None:
        return '[]'
    else:
        return json.dumps(info.ch_names)

def topomap_set_canvas ():
    """
    Set the topomap and topomap propagation series canvases.

    Parameters
    ----------
    Parameters required to be present from JS side:

    series_canvas : OffscreenCanvas
        Canvas to draw the topomap propagation series.
    topomap_canvas : OffscreenCanvas
        Canvas to draw the topomap.

    Returns
    -------
    bool
        True if the canvases are successfully set, False otherwise.
    """
    from js import series_canvas, topomap_canvas
    try:
        _topomap['series_canvas'] = series_canvas
        _topomap['topomap_canvas'] = topomap_canvas
        return True
    except Exception as e:
        print(e)
        return False

def topomap_set_channels ():
    """
    Set the EEG channel names and sampling frequency.

    Parameters
    ----------
    Parameters required to be present from JS side:

    channels : str
        JSON string containing the EEG channel names.
    sfreq : int
        Sampling frequency of the EEG data.

    Returns
    -------
    bool
        True if the EEG channel names and sampling frequency are successfully set, False otherwise.
    """
    from js import channels, sfreq
    if _topomap['montage'] is None:
        return False
    _topomap['info'] = mne.create_info(ch_names=json.loads(channels), sfreq=sfreq, ch_types='eeg')
    return True

def topomap_set_data ():
    """
    Set the EEG data for topomap and topomap propagation series plotting.

    Parameters
    ----------
    Parameters required to be present from JS side:

    data : list
        EEG signals samples for each channel in the montage.

    Returns
    -------
    bool
        True if the EEG data is successfully set, False otherwise.
    """
    if _topomap['info'] is None:
        return False
    from js import data
    _topomap['evoked'] = mne.EvokedArray(np.array(data), _topomap['info'], tmin=-0.1)
    _topomap['evoked'].set_montage(_topomap['montage'])
    return True

def topomap_set_montage ():
    """
    Set the montage for the EEG data.

    Parameters
    ----------
    Parameters required to be present from JS side:

    montage : str
        Name of the montage to set.

    Returns
    -------
    bool
        True if the montage is successfully set, False otherwise.
    """
    from js import montage
    _topomap['montage'] = mne.channels.make_standard_montage(montage)
    return True

def topomap_set_resolution ():
    """
    Set the resolution of the topomap and topomap propagation series.

    Parameters
    ----------
    Parameters required to be present from JS side:
    series : list
        Width and height of the topomap propagation series in pixels.
    topomap : list
        Width and height of the topomap in pixels.

    Returns
    -------
    bool
        True if the resolution is successfully set, False otherwise.
    """
    from js import series, topomap
    _topomap['fig_topomap'].set_size_inches(topomap[0]/100, topomap[1]/100)
    _topomap['fig_series'].set_size_inches(series[0]/100, series[1]/100)
    _topomap['fig_average'].set_size_inches(series[0]/100, series[1]/100)
    return True
