import React, { useState } from 'react'
import Head from 'next/head'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogActions from '@material-ui/core/DialogActions'
import Typography from '@material-ui/core/Typography'
import VideoCallIcon from '@material-ui/icons/VideoCall'
import Link from '../components/Link'

const useStyles = makeStyles(theme =>
  createStyles({
    root: {
      textAlign: 'center',
      color: 'white',
      paddingTop: theme.spacing(4),
    },
    logo: {
      width: 200,
    },
  })
)

function Home() {
  const classes = useStyles({})
  const author = 'Michael Schutt'
  const [open, setOpen] = useState(false)
  const handleClose = () => setOpen(false)
  const handleClick = () => setOpen(true)

  return (
    <React.Fragment>
      <Head>
        <title>VYRL :: AI Viral Video Generator</title>
      </Head>
      <div className={classes.root}>
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>About VYRL</DialogTitle>
          <DialogContent>
            <DialogContentText>
              <h2>VYRL Video Generation Engine</h2>
              <strong>Created By</strong>: {author}
              <br />
              <br />
              Questions or feature improvements?{' '}
              <a href="mailto:crosscripter@gmail.com">Email me</a>
              <br />
              <br />
              <br />
              <hr />
              <Typography variant="subtitle3" gutterBottom>
                <small>Copyright (C) 2022-2023 {author}</small>
              </Typography>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="primary" onClick={handleClose}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
        <img className={classes.logo} src="/images/logo.png" />
        <Typography variant="h5" gutterBottom>
          AI Viral Video Generator
        </Typography>
        <br />
        <br />
        <br />
        <Typography gutterBottom>
          <Link href="/generate">
            <Button
              variant="contained"
              color="primary"
              endIcon={<VideoCallIcon />}
            >
              Generate Video
            </Button>
          </Link>
        </Typography>
        <Button color="secondary" onClick={handleClick}>
          About VYRL
        </Button>
      </div>
    </React.Fragment>
  )
}

export default Home
