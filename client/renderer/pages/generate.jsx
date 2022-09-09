import React from 'react'
import Head from 'next/head'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import Link from '../components/Link'
import Generator from '../components/generator'

const useStyles = makeStyles(theme =>
  createStyles({
    root: {
      color: 'white',
      textAlign: 'center',
      paddingTop: theme.spacing(4),
    },
  })
)

function Generate() {
  const classes = useStyles({})

  return (
    <React.Fragment>
      <Head>
        <title>VYRL :: AI Viral Video Generator - Generate Video</title>
      </Head>
      <div className={classes.root}>
        <Typography variant="h4" gutterBottom>
          Video Generator
        </Typography>
        <Typography variant="text" gutterBottom>
          Generate videos using AI based on the specification below
        </Typography>
        <br />
        <br />
        <Generator />
      </div>
    </React.Fragment>
  )
}

export default Generate
