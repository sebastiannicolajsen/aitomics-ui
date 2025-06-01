import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Stack,
  Chip,
  Link,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import UpdateIcon from '@mui/icons-material/Update';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import { VersionInfo as VersionInfoType, UpdateInfo, UpdateProgress } from '../types/electron';

const RELEASES_URL = 'https://github.com/sebastiannicolajsen/aitomics-ui/releases';

const VersionInfo: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfoType | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  useEffect(() => {
    // Get version info
    window.electron?.getVersionInfo().then(setVersionInfo);

    // Listen for update status
    window.electron?.onUpdateStatus((status, info) => {
      setUpdateStatus(status);
      if (status === 'available' && info) {
        setUpdateInfo(info as UpdateInfo);
        setIsUpdateDialogOpen(true);
      } else if (status === 'downloading' && info) {
        setUpdateProgress(info as UpdateProgress);
      } else if (status === 'downloaded') {
        setUpdateProgress(null);
        setIsUpdateDialogOpen(true);
      }
    });
  }, []);

  const handleCheckForUpdates = () => {
    window.electron?.checkForUpdates();
  };

  const handleDownloadUpdate = () => {
    window.electron?.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.electron?.installUpdate();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const isBetaVersion = (version: string) => version.includes('-beta.');

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="App Information">
          <IconButton
            size="small"
            onClick={() => setIsInfoDialogOpen(true)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: 'rgba(16, 163, 127, 0.1)',
              },
            }}
          >
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            v{versionInfo?.appVersion}
          </Typography>
          {versionInfo?.appVersion && isBetaVersion(versionInfo.appVersion) && (
            <Chip
              size="small"
              label="BETA"
              sx={{
                height: '16px',
                fontSize: '0.65rem',
                bgcolor: 'warning.main',
                color: 'white',
                '& .MuiChip-label': {
                  px: 0.5,
                  fontWeight: 600,
                },
              }}
            />
          )}
        </Box>
        <Chip
          size="small"
          label={`Aitomics v${versionInfo?.aitomicsVersion}`}
          sx={{
            height: '20px',
            fontSize: '0.75rem',
            bgcolor: 'rgba(16, 163, 127, 0.1)',
            color: 'primary.main',
            '& .MuiChip-label': {
              px: 1,
            },
          }}
        />
        <Tooltip title="Check for Updates">
          <IconButton
            size="small"
            onClick={handleCheckForUpdates}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: 'rgba(16, 163, 127, 0.1)',
              },
            }}
          >
            <UpdateIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* App Info Dialog */}
      <Dialog
        open={isInfoDialogOpen}
        onClose={() => setIsInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
            Application Information
          </Typography>
          <IconButton
            onClick={() => setIsInfoDialogOpen(false)}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: 'rgba(16, 163, 127, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Application Version
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1">
                  {versionInfo?.appVersion}
                </Typography>
                {versionInfo?.appVersion && isBetaVersion(versionInfo.appVersion) && (
                  <Chip
                    size="small"
                    label="BETA"
                    sx={{
                      height: '20px',
                      fontSize: '0.75rem',
                      bgcolor: 'warning.main',
                      color: 'white',
                      '& .MuiChip-label': {
                        px: 1,
                        fontWeight: 600,
                      },
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Aitomics Version
              </Typography>
              <Typography variant="body1">
                {versionInfo?.aitomicsVersion}
              </Typography>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={<LaunchIcon />}
                component={Link}
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.electron?.ipcRenderer.invoke('open-external-link', RELEASES_URL)}
                sx={{ mt: 1 }}
              >
                Download Latest Release
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog
        open={isUpdateDialogOpen}
        onClose={() => {
          if (updateStatus !== 'downloading') {
            setIsUpdateDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
            {updateStatus === 'downloaded' ? 'Update Ready' : 'Update Available'}
          </Typography>
          {updateStatus !== 'downloading' && (
            <IconButton
              onClick={() => setIsUpdateDialogOpen(false)}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'rgba(16, 163, 127, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {updateStatus === 'downloading' ? (
            <Stack spacing={2}>
              <Typography variant="body1">
                Downloading update...
              </Typography>
              {updateProgress && (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={updateProgress.percent} 
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Stack direction="row" spacing={2} justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(updateProgress.transferred)} / {formatBytes(updateProgress.total)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(updateProgress.bytesPerSecond)}/s
                    </Typography>
                  </Stack>
                </>
              )}
            </Stack>
          ) : updateStatus === 'downloaded' ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                <CheckCircleIcon />
                <Typography variant="body1">
                  Update downloaded successfully
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                A new version ({updateInfo?.version}) is ready to install. Would you like to install it now?
              </Typography>
              {updateInfo?.releaseNotes && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Release Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {updateInfo.releaseNotes}
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body1">
                A new version ({updateInfo?.version}) is available.
              </Typography>
              {updateInfo?.releaseNotes && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Release Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {updateInfo.releaseNotes}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {updateStatus === 'downloaded' ? (
            <Button
              variant="contained"
              onClick={handleInstallUpdate}
              startIcon={<UpdateIcon />}
              sx={{ borderRadius: 2 }}
            >
              Install Update
            </Button>
          ) : updateStatus === 'available' ? (
            <Button
              variant="contained"
              onClick={handleDownloadUpdate}
              startIcon={<DownloadIcon />}
              sx={{ borderRadius: 2 }}
            >
              Download Update
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VersionInfo; 